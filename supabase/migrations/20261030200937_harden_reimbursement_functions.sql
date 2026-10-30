-- Upgrade existing projects without replacing audit or automatic-RLS functions.
alter function public.reimbursement_append_only() set search_path = pg_catalog;

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
