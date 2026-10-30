-- Service-mediated API: browsers have no direct table write or read grants.
-- The server authenticates Supabase users and checks trusted membership on every operation.
create table if not exists reimbursement_organizations (
  id text primary key, payload jsonb not null
);
create table if not exists reimbursement_policies (
  organization_id text primary key references reimbursement_organizations(id), payload jsonb not null
);
create table if not exists reimbursement_members (
  id text primary key,
  organization_id text not null references reimbursement_organizations(id),
  owner_id text,
  claim_id text,
  payload jsonb not null
);
create index if not exists reimbursement_members_organization_idx on reimbursement_members(organization_id);
alter table reimbursement_members enable row level security;
create table if not exists reimbursement_profiles (
  id text primary key,
  organization_id text not null references reimbursement_organizations(id),
  owner_id text,
  claim_id text,
  payload jsonb not null
);
create index if not exists reimbursement_profiles_organization_idx on reimbursement_profiles(organization_id);
alter table reimbursement_profiles enable row level security;
create table if not exists reimbursement_claims (
  id text primary key,
  organization_id text not null references reimbursement_organizations(id),
  owner_id text,
  claim_id text,
  payload jsonb not null
);
create index if not exists reimbursement_claims_organization_idx on reimbursement_claims(organization_id);
alter table reimbursement_claims enable row level security;
create table if not exists reimbursement_attachments (
  id text primary key,
  organization_id text not null references reimbursement_organizations(id),
  owner_id text,
  claim_id text,
  payload jsonb not null
);
create index if not exists reimbursement_attachments_organization_idx on reimbursement_attachments(organization_id);
alter table reimbursement_attachments enable row level security;
create table if not exists reimbursement_versions (
  id text primary key,
  organization_id text not null references reimbursement_organizations(id),
  owner_id text,
  claim_id text,
  payload jsonb not null
);
create index if not exists reimbursement_versions_organization_idx on reimbursement_versions(organization_id);
alter table reimbursement_versions enable row level security;
create table if not exists reimbursement_events (
  id text primary key,
  organization_id text not null references reimbursement_organizations(id),
  owner_id text,
  claim_id text,
  payload jsonb not null
);
create index if not exists reimbursement_events_organization_idx on reimbursement_events(organization_id);
alter table reimbursement_events enable row level security;
create table if not exists reimbursement_payments (
  id text primary key,
  organization_id text not null references reimbursement_organizations(id),
  owner_id text,
  claim_id text,
  payload jsonb not null
);
create index if not exists reimbursement_payments_organization_idx on reimbursement_payments(organization_id);
alter table reimbursement_payments enable row level security;
create table if not exists reimbursement_extraction_jobs (
  id text primary key,
  organization_id text not null references reimbursement_organizations(id),
  owner_id text,
  claim_id text,
  payload jsonb not null
);
create index if not exists reimbursement_extraction_jobs_organization_idx on reimbursement_extraction_jobs(organization_id);
alter table reimbursement_extraction_jobs enable row level security;
create table if not exists reimbursement_profile_versions (
  id text primary key,
  organization_id text not null references reimbursement_organizations(id),
  owner_id text,
  claim_id text,
  payload jsonb not null
);
create index if not exists reimbursement_profile_versions_organization_idx on reimbursement_profile_versions(organization_id);
alter table reimbursement_profile_versions enable row level security;
create table if not exists reimbursement_policy_versions (
  id text primary key,
  organization_id text not null references reimbursement_organizations(id),
  owner_id text,
  claim_id text,
  payload jsonb not null
);
create index if not exists reimbursement_policy_versions_organization_idx on reimbursement_policy_versions(organization_id);
alter table reimbursement_policy_versions enable row level security;
create table if not exists reimbursement_approvals (
  id text primary key,
  organization_id text not null references reimbursement_organizations(id),
  owner_id text,
  claim_id text,
  payload jsonb not null
);
create index if not exists reimbursement_approvals_organization_idx on reimbursement_approvals(organization_id);
alter table reimbursement_approvals enable row level security;
create table if not exists reimbursement_webhook_events (
  id text primary key, organization_id text not null references reimbursement_organizations(id)
);
alter table reimbursement_organizations enable row level security;
alter table reimbursement_policies enable row level security;
alter table reimbursement_webhook_events enable row level security;
create unique index if not exists reimbursement_payment_one_possible on reimbursement_payments(claim_id)
  where payload->>'status' in ('queued','processing','unknown','unclaimed','paid');
create unique index if not exists reimbursement_payment_batch_unique on reimbursement_payments((payload->>'senderBatchId'));
create unique index if not exists reimbursement_extraction_version_unique on reimbursement_extraction_jobs(claim_id, ((payload->>'version')::integer));
-- Prevent accidental mutation of submitted versions and audit history, including by server code.
create or replace function reimbursement_append_only() returns trigger language plpgsql
set search_path = pg_catalog as $$
begin raise exception 'Reimbursement history is append-only'; end; $$;
drop trigger if exists reimbursement_versions_immutable on reimbursement_versions;
create trigger reimbursement_versions_immutable before update or delete on reimbursement_versions
for each row execute function reimbursement_append_only();
drop trigger if exists reimbursement_events_immutable on reimbursement_events;
create trigger reimbursement_events_immutable before update or delete on reimbursement_events
for each row execute function reimbursement_append_only();
drop trigger if exists reimbursement_profile_versions_immutable on reimbursement_profile_versions;
create trigger reimbursement_profile_versions_immutable before update or delete on reimbursement_profile_versions
for each row execute function reimbursement_append_only();
drop trigger if exists reimbursement_policy_versions_immutable on reimbursement_policy_versions;
create trigger reimbursement_policy_versions_immutable before update or delete on reimbursement_policy_versions
for each row execute function reimbursement_append_only();
drop trigger if exists reimbursement_approvals_immutable on reimbursement_approvals;
create trigger reimbursement_approvals_immutable before update or delete on reimbursement_approvals
for each row execute function reimbursement_append_only();
-- Supabase-specific setup is conditional so the same schema is tested in local PostgreSQL.
do $$
declare r text; t text;
begin
  foreach r in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'reimbursement_%' loop
        execute format('revoke all on table public.%I from %I', t, r);
      end loop;
    end if;
  end loop;
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
      values ('receipts','receipts',false,10485760,array['image/jpeg','image/png','application/pdf'])
      on conflict (id) do nothing;
  end if;
end $$;
revoke all on function reimbursement_append_only() from public;

-- Supabase's optional automatic-RLS event trigger must not be callable through the Data API.
-- Revoking direct execution preserves its owner and existing event-trigger invocation.
do $$
declare r text;
begin
  if pg_catalog.to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public;
    foreach r in array array['anon','authenticated'] loop
      if exists (select 1 from pg_catalog.pg_roles where rolname = r) then
        execute pg_catalog.format('revoke execute on function public.rls_auto_enable() from %I', r);
      end if;
    end loop;
  end if;
end $$;
