import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/lib/db/database';
import { createDemoState } from '../src/lib/db/demo';
import { ReimbursementService } from '../src/lib/domain/service';

describe('PostgreSQL persistence and constraints', () => {
  it('keeps the local schema equal to the fresh-install migration', async () => {
    const local = await readFile(path.join(process.cwd(), 'src/lib/db/schema.sql'), 'utf8');
    const baseline = await readFile(
      path.join(process.cwd(), 'supabase/migrations/20261029235851_reimbursement_core.sql'),
      'utf8',
    );
    expect(local).toBe(baseline);
  });

  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    'hardens functions repeatably with automatic RLS=%s and API roles=%s',
    async (automaticRls, apiRoles) => {
      const pg = new PGlite();
      try {
        await pg.exec(await readFile(path.join(process.cwd(), 'src/lib/db/schema.sql'), 'utf8'));
        // Model an already-installed project whose original function had no fixed path.
        await pg.exec('alter function public.reimbursement_append_only() reset search_path');
        if (apiRoles) await pg.exec('create role anon; create role authenticated;');
        if (automaticRls) {
          await pg.exec(`
            create function public.rls_auto_enable() returns event_trigger
            language plpgsql security definer set search_path = pg_catalog as $$
            declare command record;
            begin
              for command in select * from pg_event_trigger_ddl_commands() loop
                if command.object_type = 'table' and command.schema_name = 'public' then
                  execute format('alter table %s enable row level security', command.object_identity);
                end if;
              end loop;
            end $$;
            create event trigger test_auto_rls on ddl_command_end
              when tag in ('CREATE TABLE') execute function public.rls_auto_enable();
          `);
          if (apiRoles) {
            await pg.exec(
              'grant execute on function public.rls_auto_enable() to anon, authenticated',
            );
            expect(
              (
                await pg.query<{ allowed: boolean }>(
                  "select has_function_privilege('anon','public.rls_auto_enable()','execute') as allowed",
                )
              ).rows[0].allowed,
            ).toBe(true);
          }
        }
        const migration = await readFile(
          path.join(
            process.cwd(),
            'supabase/migrations/20261030200937_harden_reimbursement_functions.sql',
          ),
          'utf8',
        );
        await pg.exec(migration);
        await pg.exec(migration);
        expect(
          (
            await pg.query<{ proconfig: string[] }>(
              "select proconfig from pg_proc where oid='public.reimbursement_append_only()'::regprocedure",
            )
          ).rows[0].proconfig,
        ).toEqual(['search_path=pg_catalog']);
        expect(
          (
            await pg.query<{ rowsecurity: boolean }>(
              "select rowsecurity from pg_tables where schemaname='public' and tablename like 'reimbursement_%'",
            )
          ).rows.every((table) => table.rowsecurity),
        ).toBe(true);
        if (automaticRls) {
          expect(
            (
              await pg.query<{ count: number }>(
                `select count(*)::integer as count from pg_proc p,
              lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
              where p.oid='public.rls_auto_enable()'::regprocedure
                and acl.grantee=0 and acl.privilege_type='EXECUTE'`,
              )
            ).rows[0].count,
          ).toBe(0);
          expect(
            (
              await pg.query<{ allowed: boolean }>(
                "select has_function_privilege(current_user,'public.rls_auto_enable()','execute') as allowed",
              )
            ).rows[0].allowed,
          ).toBe(true);
          // Existing event-trigger invocation remains usable despite direct EXECUTE revocation.
          await pg.exec('create table public.auto_rls_probe (id integer)');
          expect(
            (
              await pg.query<{ rowsecurity: boolean }>(
                "select rowsecurity from pg_tables where schemaname='public' and tablename='auto_rls_probe'",
              )
            ).rows[0].rowsecurity,
          ).toBe(true);
          if (apiRoles) {
            for (const role of ['anon', 'authenticated']) {
              expect(
                (
                  await pg.query<{ allowed: boolean }>(
                    "select has_function_privilege($1,'public.rls_auto_enable()','execute') as allowed",
                    [role],
                  )
                ).rows[0].allowed,
              ).toBe(false);
              await pg.exec(`set role ${role}`);
              try {
                await expect(pg.exec('select public.rls_auto_enable()')).rejects.toThrow(
                  'permission denied',
                );
              } finally {
                await pg.exec('reset role');
              }
            }
          }
          // A fresh/reapplied baseline also protects a platform-created function already present.
          await pg.exec('grant execute on function public.rls_auto_enable() to public');
          if (apiRoles)
            await pg.exec(
              'grant execute on function public.rls_auto_enable() to anon, authenticated',
            );
          await pg.exec(await readFile(path.join(process.cwd(), 'src/lib/db/schema.sql'), 'utf8'));
          expect(
            (
              await pg.query<{ count: number }>(
                `select count(*)::integer as count from pg_proc p,
              lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
              where p.oid='public.rls_auto_enable()'::regprocedure
                and acl.grantee=0 and acl.privilege_type='EXECUTE'`,
              )
            ).rows[0].count,
          ).toBe(0);
          if (apiRoles) {
            for (const role of ['anon', 'authenticated'])
              expect(
                (
                  await pg.query<{ allowed: boolean }>(
                    "select has_function_privilege($1,'public.rls_auto_enable()','execute') as allowed",
                    [role],
                  )
                ).rows[0].allowed,
              ).toBe(false);
          }
        } else {
          expect(
            (
              await pg.query<{ function: string | null }>(
                "select to_regprocedure('public.rls_auto_enable()') as function",
              )
            ).rows[0].function,
          ).toBeNull();
        }
      } finally {
        await pg.close();
      }
    },
  );

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
