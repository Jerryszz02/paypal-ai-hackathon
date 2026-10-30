import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Pool, type PoolClient } from 'pg';
import { z } from 'zod';
import type { Member, Organization, Policy } from '../src/lib/types';

const memberSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(200),
    email: z
      .email()
      .max(254)
      .transform((email) => email.toLowerCase()),
    role: z.enum(['applicant', 'reviewer']),
  })
  .strict();
export function parseMembers(value: unknown): Member[] {
  const entries = z.array(memberSchema).min(2).max(100).parse(value);
  if (
    new Set(entries.map((entry) => entry.id)).size !== entries.length ||
    new Set(entries.map((entry) => entry.email)).size !== entries.length
  )
    throw new Error('Member IDs and emails must be unique.');
  if (
    !entries.some((entry) => entry.role === 'applicant') ||
    !entries.some((entry) => entry.role === 'reviewer')
  )
    throw new Error('Include at least one applicant and one separate finance reviewer.');
  return entries.map((entry) => ({ ...entry, organizationId: 'northstar' }));
}

export async function provisionWorkspace(
  members: Member[],
  connectionString: string,
): Promise<void> {
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('begin');
    await client.query("set local lock_timeout = '5s'");
    const expectedTables = [
      'reimbursement_organizations',
      'reimbursement_members',
      'reimbursement_policies',
      'reimbursement_policy_versions',
    ];
    for (const table of expectedTables) {
      const result = await client.query<{ relation: string | null }>(
        'select to_regclass($1)::text as relation',
        [`public.${table}`],
      );
      if (!result.rows[0]?.relation)
        throw new Error('Apply the repository SQL migration before provisioning this workspace.');
    }
    const existing = await client.query('select id from reimbursement_organizations where id=$1', [
      'northstar',
    ]);
    if (existing.rows.length)
      throw new Error(
        'The northstar organization already exists. This script will not overwrite it.',
      );
    const identities = await client.query<{ id: string; email: string | null }>(
      'select id::text,email from auth.users where id = any($1::uuid[])',
      [members.map((member) => member.id)],
    );
    for (const member of members) {
      const identity = identities.rows.find((user) => user.id === member.id);
      if (!identity || identity.email?.toLowerCase() !== member.email)
        throw new Error(
          'Every member must match an existing Supabase Auth user ID and email. Create and verify those accounts separately first.',
        );
    }
    const now = new Date().toISOString();
    const organization: Organization = {
      id: 'northstar',
      name: 'Northstar Studio',
      currency: 'GBP',
      timezone: 'Europe/London',
    };
    const policy: Policy = {
      organizationId: organization.id,
      version: 1,
      currency: 'GBP',
      timezone: 'Europe/London',
      autoPaymentEnabled: false,
      autoCategories: ['transport', 'office_supplies'],
      singleLimitMinor: 5000,
      monthlyLimitMinor: 20000,
      maxAgeDays: 30,
      updatedAt: now,
    };
    // Deliberately no upserts: a concurrent run or existing identity must fail atomically.
    await client.query(
      'insert into reimbursement_organizations (id,payload) values ($1,$2::jsonb)',
      [organization.id, JSON.stringify(organization)],
    );
    await client.query(
      'insert into reimbursement_policies (organization_id,payload) values ($1,$2::jsonb)',
      [organization.id, JSON.stringify(policy)],
    );
    await client.query(
      'insert into reimbursement_policy_versions (id,organization_id,payload) values ($1,$2,$3::jsonb)',
      [`${organization.id}:1`, organization.id, JSON.stringify(policy)],
    );
    for (const member of members)
      await client.query(
        'insert into reimbursement_members (id,organization_id,payload) values ($1,$2,$3::jsonb)',
        [member.id, organization.id, JSON.stringify(member)],
      );
    await client.query('commit');
  } catch (error) {
    if (client) await client.query('rollback');
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505')
      throw new Error('An organization or membership already exists. No records were overwritten.');
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    console.log(
      'Usage: node --env-file=.env.local --import tsx scripts/provision-workspace.ts ./members.json\nRequires APP_MODE=sandbox and DATABASE_URL. Creates one Northstar Studio workspace with trusted existing Auth memberships. Refuses existing organizations. Does not create Auth users, send emails, call AI, or send payments.',
    );
    return;
  }
  if (args.length !== 1 || args[0].startsWith('-'))
    throw new Error('Provide one members JSON file. Use --help for usage.');
  // Validate the local input before opening any database connection.
  const members = parseMembers(JSON.parse(await readFile(path.resolve(args[0]), 'utf8')));
  if (process.env.APP_MODE !== 'sandbox')
    throw new Error('Set APP_MODE=sandbox explicitly before provisioning.');
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString)
    throw new Error('Configure DATABASE_URL in the ignored server environment file.');
  await provisionWorkspace(members, connectionString);
  console.log(
    `Created Northstar Studio with ${members.length} trusted memberships. Automatic payments are off. Each applicant must separately confirm their PayPal recipient profile in Settings.`,
  );
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    // Never print connection errors or database driver objects containing credentials.
    const safe =
      error instanceof z.ZodError
        ? 'Invalid members JSON. Use UUID Auth IDs, names, emails and applicant/reviewer roles only.'
        : error instanceof Error && !('code' in error)
          ? error.message
          : 'Provisioning failed. Check the connection, migration and Auth accounts. No partial workspace was committed.';
    console.error(safe);
    process.exitCode = 1;
  });
}
