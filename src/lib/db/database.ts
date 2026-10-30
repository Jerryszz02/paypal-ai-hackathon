import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import type { Pool, PoolClient } from 'pg';
import type {
  Approval,
  Attachment,
  Claim,
  ClaimVersion,
  Extraction,
  Member,
  Organization,
  PaymentIntent,
  Policy,
  RecipientProfile,
  TimelineEvent,
} from '../types';

export interface ExtractionJob {
  id: string;
  organizationId: string;
  claimId: string;
  version: number;
  status: 'running' | 'complete' | 'failed';
  attempts: number;
  leaseUntil: string;
  result: Extraction | null;
  runToken?: string;
}
export interface OrganizationState {
  organization: Organization;
  members: Member[];
  profiles: RecipientProfile[];
  policy: Policy;
  claims: Claim[];
  attachments: Attachment[];
  versions: ClaimVersion[];
  events: TimelineEvent[];
  payments: PaymentIntent[];
  extractionJobs: ExtractionJob[];
  webhookIds: string[];
  profileHistory: RecipientProfile[];
  policyHistory: Policy[];
  approvals: (Approval & { claimId: string; organizationId: string; ownerId: string })[];
}
interface QueryResult<T> {
  rows: T[];
}
export interface SqlClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}
export interface Database {
  getMember(id: string): Promise<Member | null>;
  members(): Promise<Member[]>;
  transaction<T>(
    organizationId: string,
    work: (state: OrganizationState) => T | Promise<T>,
  ): Promise<T>;
  findPayment(id: string): Promise<{ organizationId: string } | null>;
  listOrganizationIds(): Promise<string[]>;
  seed(state: OrganizationState): Promise<void>;
  close(): Promise<void>;
}

const tables = {
  members: 'reimbursement_members',
  profiles: 'reimbursement_profiles',
  claims: 'reimbursement_claims',
  attachments: 'reimbursement_attachments',
  versions: 'reimbursement_versions',
  events: 'reimbursement_events',
  payments: 'reimbursement_payments',
  extractionJobs: 'reimbursement_extraction_jobs',
  profileHistory: 'reimbursement_profile_versions',
  policyHistory: 'reimbursement_policy_versions',
  approvals: 'reimbursement_approvals',
} as const;

async function stateFrom(client: SqlClient, organizationId: string): Promise<OrganizationState> {
  const org = await client.query<{ payload: Organization }>(
    'select payload from reimbursement_organizations where id = $1 for update',
    [organizationId],
  );
  if (!org.rows[0]) throw new Error('Organization does not exist');
  const policy = await client.query<{ payload: Policy }>(
    'select payload from reimbursement_policies where organization_id = $1',
    [organizationId],
  );
  if (!policy.rows[0]) throw new Error('Organization policy does not exist');
  const state = {
    organization: org.rows[0].payload,
    policy: policy.rows[0].payload,
  } as OrganizationState;
  for (const [key, table] of Object.entries(tables)) {
    const result = await client.query<{ payload: unknown }>(
      `select payload from ${table} where organization_id = $1 order by id`,
      [organizationId],
    );
    Object.assign(state, { [key]: result.rows.map((row) => row.payload) });
  }
  const hooks = await client.query<{ id: string }>(
    'select id from reimbursement_webhook_events where organization_id = $1',
    [organizationId],
  );
  state.webhookIds = hooks.rows.map((row) => row.id);
  return state;
}

async function persist(client: SqlClient, state: OrganizationState): Promise<void> {
  const orgId = state.organization.id;
  await client.query(
    'insert into reimbursement_policies (organization_id,payload) values ($1,$2::jsonb) on conflict (organization_id) do update set payload=excluded.payload',
    [orgId, JSON.stringify(state.policy)],
  );
  for (const [key, table] of Object.entries(tables)) {
    const immutable = [
      'versions',
      'events',
      'profileHistory',
      'policyHistory',
      'approvals',
    ].includes(key);
    for (const entity of state[key as keyof typeof tables] as unknown[]) {
      const item = entity as Record<string, unknown>;
      const id =
        key === 'profiles'
          ? item.userId
          : key === 'versions'
            ? `${item.claimId}:${item.version}`
            : key === 'profileHistory'
              ? `${item.userId}:${item.version}`
              : key === 'policyHistory'
                ? `${orgId}:${item.version}`
                : item.id;
      const ownerId = item.ownerId ?? item.userId ?? null;
      const claimId = item.claimId ?? (key === 'claims' ? item.id : null);
      await client.query(
        `insert into ${table} (id,organization_id,owner_id,claim_id,payload) values ($1,$2,$3,$4,$5::jsonb) on conflict (id) ${immutable ? 'do nothing' : 'do update set payload=excluded.payload'}`,
        [id, orgId, ownerId, claimId, JSON.stringify(item)],
      );
    }
  }
  for (const id of state.webhookIds)
    await client.query(
      'insert into reimbursement_webhook_events (id,organization_id) values ($1,$2) on conflict (id) do nothing',
      [id, orgId],
    );
}

export interface DatabaseOptions {
  connectionString?: string;
  dataDir?: string;
  migrationSql?: string;
}
export async function createDatabase(options: DatabaseOptions = {}): Promise<Database> {
  let local: PGlite | undefined;
  let pool: Pool | undefined;
  if (options.connectionString) {
    const { Pool: PgPool } = await import('pg');
    pool = new PgPool({ connectionString: options.connectionString, max: 5 });
  } else {
    const { PGlite: LocalPostgres } = await import('@electric-sql/pglite');
    local = new LocalPostgres(options.dataDir ?? 'memory://');
    await local.waitReady;
  }
  const query = async <T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> => {
    if (local) return local.query<T>(sql, params);
    return pool!.query(sql, params) as unknown as Promise<QueryResult<T>>;
  };
  // Hosted schemas are installed explicitly by migrations, never on first web request.
  if (local) {
    const sql =
      options.migrationSql ??
      (await readFile(path.join(process.cwd(), 'src/lib/db/schema.sql'), 'utf8'));
    await local.exec(sql);
  }
  async function inTransaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T> {
    if (local)
      return local.transaction(async (tx) =>
        work({
          query: <R>(sql: string, params: unknown[] = []) =>
            tx.query<R>(sql, params) as Promise<QueryResult<R>>,
        }),
      );
    const client: PoolClient = await pool!.connect();
    try {
      await client.query('begin');
      const result = await work({
        query: <R>(sql: string, params: unknown[] = []) =>
          client.query(sql, params) as unknown as Promise<QueryResult<R>>,
      });
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
  return {
    async getMember(id) {
      return (
        (
          await query<{ payload: Member }>(
            'select payload from reimbursement_members where id=$1',
            [id],
          )
        ).rows[0]?.payload ?? null
      );
    },
    async members() {
      return (
        await query<{ payload: Member }>('select payload from reimbursement_members order by id')
      ).rows.map((r) => r.payload);
    },
    transaction(organizationId, work) {
      return inTransaction(async (client) => {
        const state = await stateFrom(client, organizationId);
        const result = await work(state);
        await persist(client, state);
        return structuredClone(result);
      });
    },
    async findPayment(id) {
      const row = (
        await query<{ organization_id: string }>(
          'select organization_id from reimbursement_payments where id=$1',
          [id],
        )
      ).rows[0];
      return row ? { organizationId: row.organization_id } : null;
    },
    async listOrganizationIds() {
      return (await query<{ id: string }>('select id from reimbursement_organizations')).rows.map(
        (r) => r.id,
      );
    },
    seed(state) {
      return inTransaction(async (client) => {
        const result = await client.query(
          'insert into reimbursement_organizations (id,payload) values ($1,$2::jsonb) on conflict (id) do nothing returning id',
          [state.organization.id, JSON.stringify(state.organization)],
        );
        if (result.rows.length) await persist(client, state);
      });
    },
    async close() {
      if (local) await local.close();
      if (pool) await pool.end();
    },
  };
}
