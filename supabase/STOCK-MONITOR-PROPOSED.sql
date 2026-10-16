-- REVIEW PROPOSAL ONLY: attribution project razskzqcijosftvyuipi, never the stock project.
-- One append-only monitor history table; no stock, payment, credential or Ads changes.
begin;
create table if not exists public.ga_stock_monitor_runs (
 id bigint generated always as identity primary key,
 account_id text not null check(account_id ~ '^[0-9]{10}$'),
 source_project text not null check(source_project='dmjunqbncyrinykbbmfk'),
 slot timestamptz not null,
 status text not null check(status in ('complete','failed')),
 snapshot jsonb,
 error_code text check(error_code in ('inventory_read_failed')),
 initiated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(account_id,source_project,slot,status),
 check((status='complete' and error_code is null and snapshot is not null
   and jsonb_typeof(snapshot)='object' and snapshot->>'sourceProject' is not null
   and snapshot->>'sourceProject'=source_project and snapshot @> '{"complete":true}'::jsonb
   and snapshot ? 'parts' and snapshot ? 'drafts'
   and jsonb_typeof(snapshot->'parts')='array'
   and jsonb_typeof(snapshot->'drafts')='array')
  or (status='failed' and snapshot is null and error_code is not null))
);
create index if not exists ga_stock_monitor_recent on public.ga_stock_monitor_runs(account_id,source_project,status,created_at desc);
alter table public.ga_stock_monitor_runs enable row level security;
revoke all on public.ga_stock_monitor_runs from public,anon,authenticated,service_role;
grant select,insert on public.ga_stock_monitor_runs to service_role;
grant usage,select on sequence public.ga_stock_monitor_runs_id_seq to service_role;
commit;
