-- Proposed only. Apply after review in the attribution database, never the CRM.
-- Requires CONNECTIONS-PROPOSED.sql. No Google Ads mutations are enabled.
begin;
alter table public.ga_connections drop constraint if exists ga_connections_id_check;
alter table public.ga_connections add constraint ga_connections_id_check
 check(id in ('google','google_ads','google_ads_management','supabase_calls','supabase_crm'));
create table if not exists public.ga_ads_observations (
 id bigint generated always as identity primary key,
 account_id text not null check(account_id ~ '^[0-9]{10}$'),
 slot timestamptz not null,
 observation jsonb not null check(jsonb_typeof(observation)='object' and observation ? 'accountId' and observation->>'accountId' is not null and observation->>'accountId'=account_id),
 created_at timestamptz not null default now(),
 unique(account_id,slot)
);
alter table public.ga_ads_observations enable row level security;
revoke all on public.ga_ads_observations from public,anon,authenticated,service_role;
grant select,insert on public.ga_ads_observations to service_role;
grant usage,select on sequence public.ga_ads_observations_id_seq to service_role;
commit;
