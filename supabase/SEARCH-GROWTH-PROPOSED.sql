-- Additive growth monitoring; no Google API changes or inventory changes.
begin;
alter table public.ga_ads_control add column protect_existing_ads boolean not null default true;
update public.ga_ads_control set stock_enabled=false,global_paused=true;
create table public.ga_ads_search_runs(
 id bigint generated always as identity primary key,account_id text not null references public.ga_ads_control(account_id),
 slot timestamptz not null,report jsonb,status text not null check(status in('complete','failed')),error_code text,
 created_at timestamptz not null default now(),unique(account_id,slot,status),
 check((status='complete' and report is not null) or (status='failed' and report is null))
);
create index ga_ads_search_recent on public.ga_ads_search_runs(account_id,id desc);
create table public.ga_ads_growth_notifications(
 notification_key text primary key check(notification_key ~ '^[a-f0-9]{64}$'),
 account_id text not null references public.ga_ads_control(account_id),opportunity_id text not null,
 kind text not null check(kind='new_draft_prepared'),details jsonb not null,created_at timestamptz not null default now()
);
create index ga_ads_growth_notifications_history on public.ga_ads_growth_notifications(account_id,created_at desc);
alter table public.ga_ads_search_runs enable row level security;
alter table public.ga_ads_growth_notifications enable row level security;
revoke all on public.ga_ads_search_runs,public.ga_ads_growth_notifications from public,anon,authenticated,service_role;
grant select,insert on public.ga_ads_search_runs,public.ga_ads_growth_notifications to service_role;
grant usage,select on sequence public.ga_ads_search_runs_id_seq to service_role;
commit;
