import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseMembers, provisionWorkspace } from '../scripts/provision-workspace';

let postgres: PGlite;
vi.mock('pg', () => ({
  Pool: class {
    async connect() {
      return {
        query: (sql: string, params?: unknown[]) => postgres.query(sql, params),
        release() {},
      };
    }
    async end() {}
  },
}));
const inputs = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Alex',
    email: 'alex@example.test',
    role: 'applicant',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Morgan',
    email: 'morgan@example.test',
    role: 'reviewer',
  },
];
beforeEach(async () => {
  postgres = new PGlite();
  await postgres.exec(await readFile(path.join(process.cwd(), 'src/lib/db/schema.sql'), 'utf8'));
  await postgres.exec(
    'create schema auth; create table auth.users(id uuid primary key,email text);',
  );
  for (const user of inputs)
    await postgres.query('insert into auth.users(id,email) values ($1::uuid,$2)', [
      user.id,
      user.email,
    ]);
});
afterEach(async () => {
  await postgres.close();
});
describe('controlled workspace provisioning', () => {
  it('creates trusted membership and a disabled policy without creating recipients, claims or payments', async () => {
    await provisionWorkspace(parseMembers(inputs), 'postgres://unused-local-test');
    const members = await postgres.query<{ payload: { role: string } }>(
      'select payload from reimbursement_members',
    );
    expect(members.rows.map((row) => row.payload.role).sort()).toEqual(['applicant', 'reviewer']);
    expect(
      (
        await postgres.query<{ payload: { autoPaymentEnabled: boolean } }>(
          'select payload from reimbursement_policies',
        )
      ).rows[0].payload.autoPaymentEnabled,
    ).toBe(false);
    for (const table of [
      'reimbursement_profiles',
      'reimbursement_claims',
      'reimbursement_payments',
    ])
      expect((await postgres.query(`select * from ${table}`)).rows).toHaveLength(0);
    expect((await postgres.query('select * from auth.users')).rows).toHaveLength(2);
  });
  it('refuses an existing workspace and leaves its records unchanged', async () => {
    await provisionWorkspace(parseMembers(inputs), 'postgres://unused-local-test');
    await expect(
      provisionWorkspace(parseMembers(inputs), 'postgres://unused-local-test'),
    ).rejects.toThrow('already exists');
    expect((await postgres.query('select * from reimbursement_members')).rows).toHaveLength(2);
    expect((await postgres.query('select * from reimbursement_policy_versions')).rows).toHaveLength(
      1,
    );
  });
  it('rolls back when a declared UUID or email does not match existing Auth identities', async () => {
    const members = parseMembers(
      inputs.map((member, index) => (index ? { ...member, email: 'other@example.test' } : member)),
    );
    await expect(provisionWorkspace(members, 'postgres://unused-local-test')).rejects.toThrow(
      'existing Supabase Auth',
    );
    expect((await postgres.query('select * from reimbursement_organizations')).rows).toHaveLength(
      0,
    );
    expect((await postgres.query('select * from reimbursement_members')).rows).toHaveLength(0);
  });
  it('rejects forged roles, non-UUIDs, duplicate identities and an all-reviewer workspace', () => {
    expect(() => parseMembers([{ ...inputs[0], id: 'alex' }, inputs[1]])).toThrow();
    expect(() => parseMembers([{ ...inputs[0], role: 'admin' }, inputs[1]])).toThrow();
    expect(() => parseMembers([inputs[0], inputs[0]])).toThrow();
    expect(() => parseMembers(inputs.map((member) => ({ ...member, role: 'reviewer' })))).toThrow();
    expect(() =>
      parseMembers([{ ...inputs[0], password: 'must-not-be-in-this-file' }, inputs[1]]),
    ).toThrow();
  });
});
