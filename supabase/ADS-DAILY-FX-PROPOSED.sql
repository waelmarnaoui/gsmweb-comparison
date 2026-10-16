-- Google Finance current-price capture via the existing connected spreadsheet.
begin;
create table if not exists public.ga_ads_daily_fx (
 account_id text not null check(account_id ~ '^[0-9]{10}$'),
 rate_date date not null,
 rate numeric(18,8) not null check(rate>0 and rate<=100),
 source text not null default 'google_finance_sheet' check(source='google_finance_sheet'),
 source_currency text not null default 'USD' check(source_currency='USD'),
 target_currency text not null default 'RON' check(target_currency='RON'),
 captured_at timestamptz not null default now(),
 primary key(account_id,rate_date)
);
alter table public.ga_ads_daily_fx enable row level security;
revoke all on public.ga_ads_daily_fx from public,anon,authenticated,service_role;
grant select,insert on public.ga_ads_daily_fx to service_role;
commit;
