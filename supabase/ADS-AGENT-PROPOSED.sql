-- Proposed only. Attribution database. Requires ADS-OBSERVATION-PROPOSED.sql.
-- No Google Ads execution is enabled by this migration.
begin;
create table if not exists public.ga_agent_daily_checkins (
 id bigint generated always as identity primary key,
 account_id text not null check(account_id ~ '^[0-9]{10}$'),
 business_date date not null,
 amount_bani bigint not null check(amount_bani between 0 and 100000000),
 actor uuid not null references auth.users(id),
 source text not null default 'owner_confirmed' check(source='owner_confirmed'),
 created_at timestamptz not null default now()
);
create index if not exists ga_agent_daily_latest on public.ga_agent_daily_checkins(account_id,business_date,id desc);
alter table public.ga_agent_daily_checkins enable row level security;
revoke all on public.ga_agent_daily_checkins from public,anon,authenticated,service_role;
grant select,insert on public.ga_agent_daily_checkins to service_role;
grant usage,select on sequence public.ga_agent_daily_checkins_id_seq to service_role;

create table if not exists public.ga_agent_exchanges (
 id uuid primary key,
 account_id text not null check(account_id ~ '^[0-9]{10}$'),
 actor uuid not null references auth.users(id),
 user_message text not null check(length(user_message) between 1 and 4000),
 assistant_reply jsonb,
 observation_at timestamptz,
 state text not null default 'pending' check(state in ('pending','completed','failed')),
 created_at timestamptz not null default now(),
 check(state!='completed' or (assistant_reply is not null and jsonb_typeof(assistant_reply)='object'))
);
create index if not exists ga_agent_exchanges_history on public.ga_agent_exchanges(account_id,actor,created_at desc);
alter table public.ga_agent_exchanges enable row level security;
revoke all on public.ga_agent_exchanges from public,anon,authenticated,service_role;
grant select,insert on public.ga_agent_exchanges to service_role;
grant update(assistant_reply,state) on public.ga_agent_exchanges to service_role;

create or replace function public.ga_claim_agent_exchange(p_id uuid,p_account text,p_actor uuid,p_message text,p_observation_at timestamptz)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.ga_admins where user_id=p_actor) then raise exception 'Forbidden'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
 if exists(select 1 from public.ga_agent_exchanges where id=p_id) then return false; end if;
 if exists(select 1 from public.ga_agent_exchanges where actor=p_actor and state='pending' and created_at>now()-interval '2 minutes') then raise exception 'Chat request already running'; end if;
 if (select count(*) from public.ga_agent_exchanges where actor=p_actor and created_at>now()-interval '1 hour')>=30 then raise exception 'Hourly chat limit reached'; end if;
 insert into public.ga_agent_exchanges(id,account_id,actor,user_message,observation_at) values(p_id,p_account,p_actor,p_message,p_observation_at);
 return true;
end $$;
revoke all on function public.ga_claim_agent_exchange(uuid,text,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.ga_claim_agent_exchange(uuid,text,uuid,text,timestamptz) to service_role;
commit;
