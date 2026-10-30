import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/lib/db/database';
import { createDemoState } from '../src/lib/db/demo';
import { ReimbursementService } from '../src/lib/domain/service';

describe('PostgreSQL persistence and constraints', () => {
  it('retains claims and recipient versions after closing and reopening the database', async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), 'carry-db-'));
    try {
      let db = await createDatabase({ dataDir });
      await db.seed(createDemoState('2026-10-30T12:00:00.000Z', false));
      let service = new ReimbursementService(db);
      const claim = await service.createDraft('alex', { merchant: 'Persistent receipt' });
      await service.updateProfile('alex', { email: 'alex@example.test', confirmed: true });
      await db.close();
      db = await createDatabase({ dataDir });
      service = new ReimbursementService(db);
      expect((await service.getClaim('alex', claim.id)).merchant).toBe('Persistent receipt');
      expect((await service.bootstrap('alex')).profile).toMatchObject({
        email: 'alex@example.test',
        version: 1,
      });
      await db.close();
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
  it('enables RLS on every application table and makes submitted histories append-only', async () => {
    const pg = new PGlite();
    try {
      await pg.exec(await readFile(path.join(process.cwd(), 'src/lib/db/schema.sql'), 'utf8'));
      const tables = await pg.query<{ tablename: string; rowsecurity: boolean }>(
        "select tablename, rowsecurity from pg_tables where schemaname='public' and tablename like 'reimbursement_%'",
      );
      expect(tables.rows.length).toBeGreaterThan(10);
      expect(tables.rows.every((table) => table.rowsecurity)).toBe(true);
      const policies = await pg.query('select * from pg_policies where schemaname=$1', ['public']);
      expect(policies.rows).toHaveLength(0); // Application endpoints are the only access path.
      await pg.query('insert into reimbursement_organizations (id,payload) values ($1,$2::jsonb)', [
        'org',
        '{}',
      ]);
      await pg.exec(
        'create role authenticated; grant select,insert on reimbursement_claims to authenticated;',
      );
      await pg.query(
        'insert into reimbursement_claims (id,organization_id,payload) values ($1,$2,$3::jsonb)',
        ['claim', 'org', '{}'],
      );
      await pg.exec('set role authenticated');
      expect((await pg.query('select * from reimbursement_claims')).rows).toHaveLength(0);
      await expect(
        pg.query(
          'insert into reimbursement_claims (id,organization_id,payload) values ($1,$2,$3::jsonb)',
          ['other', 'org', '{}'],
        ),
      ).rejects.toThrow('row-level security');
      await pg.exec('reset role');
      await pg.query(
        'insert into reimbursement_versions (id,organization_id,payload) values ($1,$2,$3::jsonb)',
        ['claim:1', 'org', '{}'],
      );
      await expect(
        pg.query('update reimbursement_versions set payload=$1::jsonb where id=$2', [
          '{"changed":true}',
          'claim:1',
        ]),
      ).rejects.toThrow('append-only');
      await expect(
        pg.query('delete from reimbursement_versions where id=$1', ['claim:1']),
      ).rejects.toThrow('append-only');
      await pg.query(
        'insert into reimbursement_events (id,organization_id,payload) values ($1,$2,$3::jsonb)',
        ['event', 'org', '{}'],
      );
      await expect(
        pg.query('delete from reimbursement_events where id=$1', ['event']),
      ).rejects.toThrow('append-only');
    } finally {
      await pg.close();
    }
  });
  it('enforces one possibly payable intent and unique batch IDs in SQL', async () => {
    const pg = new PGlite();
    try {
      await pg.exec(await readFile(path.join(process.cwd(), 'src/lib/db/schema.sql'), 'utf8'));
      await pg.query('insert into reimbursement_organizations (id,payload) values ($1,$2::jsonb)', [
        'org',
        '{}',
      ]);
      await pg.query(
        'insert into reimbursement_payments (id,organization_id,claim_id,payload) values ($1,$2,$3,$4::jsonb)',
        [
          'intent-1',
          'org',
          'claim',
          JSON.stringify({ senderBatchId: 'batch-1', status: 'unknown' }),
        ],
      );
      await expect(
        pg.query(
          'insert into reimbursement_payments (id,organization_id,claim_id,payload) values ($1,$2,$3,$4::jsonb)',
          [
            'intent-2',
            'org',
            'claim',
            JSON.stringify({ senderBatchId: 'batch-2', status: 'queued' }),
          ],
        ),
      ).rejects.toThrow('reimbursement_payment_one_possible');
      await expect(
        pg.query(
          'insert into reimbursement_payments (id,organization_id,claim_id,payload) values ($1,$2,$3,$4::jsonb)',
          [
            'intent-3',
            'org',
            'other',
            JSON.stringify({ senderBatchId: 'batch-1', status: 'queued' }),
          ],
        ),
      ).rejects.toThrow('reimbursement_payment_batch_unique');
    } finally {
      await pg.close();
    }
  });
});
