begin;
alter table public.ga_ads_control add column agent_chat_enabled boolean not null default false,add column agent_chat_authorization text;
alter table public.ga_ads_control add constraint ga_agent_chat_authorized check(not agent_chat_enabled or agent_chat_authorization is not null);
create table public.ga_agent_runtime_checks(
 account_id text not null references public.ga_ads_control(account_id),version text not null,status text not null check(status in('running','completed','failed')),details jsonb,created_at timestamptz not null default now(),finished_at timestamptz,primary key(account_id,version)
);
alter table public.ga_agent_runtime_checks enable row level security;
revoke all on public.ga_agent_runtime_checks from public,anon,authenticated,service_role;
grant select,insert on public.ga_agent_runtime_checks to service_role;
grant update(status,details,finished_at) on public.ga_agent_runtime_checks to service_role;
create table public.ga_agent_tool_runs(
 id uuid primary key,exchange_id uuid not null references public.ga_agent_exchanges(id),account_id text not null references public.ga_ads_control(account_id),actor uuid not null references auth.users(id),
 external_id text not null check(length(external_id) between 1 and 200),tool text not null,input jsonb not null,
 state text not null default 'pending' check(state in('pending','completed','failed')),result jsonb,error_code text,
 created_at timestamptz not null default now(),finished_at timestamptz,unique(exchange_id,external_id)
);
create index ga_agent_tools_history on public.ga_agent_tool_runs(account_id,actor,created_at desc);
create index ga_agent_tools_actor_fk on public.ga_agent_tool_runs(actor);
create table public.ga_agent_jobs(
 id uuid primary key,account_id text not null references public.ga_ads_control(account_id),actor uuid not null references auth.users(id),kind text not null check(kind in('control_cycle','source_change')),
 state text not null default 'queued' check(state in('queued','running','awaiting_review','completed','failed','uncertain')),
 payload jsonb not null,result jsonb,error_code text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index ga_agent_jobs_queue on public.ga_agent_jobs(account_id,state,created_at);
create index ga_agent_jobs_actor_fk on public.ga_agent_jobs(actor);
create table public.ga_agent_preferences(
 account_id text not null references public.ga_ads_control(account_id),name text not null check(length(name) between 1 and 80),value text not null check(length(value) between 1 and 2400),
 actor uuid not null references auth.users(id),updated_at timestamptz not null default now(),primary key(account_id,name)
);
create index ga_agent_preferences_actor_fk on public.ga_agent_preferences(actor);
create table public.ga_agent_job_events(
 id bigint generated always as identity primary key,job_id uuid not null references public.ga_agent_jobs(id),account_id text not null references public.ga_ads_control(account_id),state text not null,details jsonb not null,created_at timestamptz not null default now()
);
create index ga_agent_job_events_job on public.ga_agent_job_events(job_id,id);
create index ga_agent_job_events_account on public.ga_agent_job_events(account_id,id desc);
create function public.ga_agent_job_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' and (new.id<>old.id or new.account_id<>old.account_id or new.actor<>old.actor or new.kind<>old.kind or new.payload is distinct from old.payload) then raise exception 'Job identity and payload are immutable';end if;
 insert into public.ga_agent_job_events(job_id,account_id,state,details) values(new.id,new.account_id,new.state,jsonb_build_object('result',new.result,'error',new.error_code));return new;
end $$;
create trigger ga_agent_job_audit after insert or update on public.ga_agent_jobs for each row execute function public.ga_agent_job_audit();
create function public.ga_agent_chat_settings_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.ga_ads_action_events(account_id,event,details) values(new.account_id,'chat_action_permissions',jsonb_build_object('enabled',new.agent_chat_enabled,'authorization',new.agent_chat_authorization));return new;
end $$;
create trigger ga_agent_chat_settings_audit after update of agent_chat_enabled,agent_chat_authorization on public.ga_ads_control for each row execute function public.ga_agent_chat_settings_audit();
alter table public.ga_agent_tool_runs enable row level security;
alter table public.ga_agent_jobs enable row level security;
alter table public.ga_agent_preferences enable row level security;
alter table public.ga_agent_job_events enable row level security;
revoke all on public.ga_agent_tool_runs,public.ga_agent_jobs,public.ga_agent_preferences,public.ga_agent_job_events from public,anon,authenticated,service_role;
grant select,insert on public.ga_agent_tool_runs,public.ga_agent_jobs to service_role;
grant update(state,result,error_code,finished_at) on public.ga_agent_tool_runs to service_role;
grant update(state,result,error_code,updated_at) on public.ga_agent_jobs to service_role;
grant select,insert,update on public.ga_agent_preferences to service_role;
grant select,insert on public.ga_agent_job_events to service_role;
grant usage,select on sequence public.ga_agent_job_events_id_seq to service_role;
revoke all on function public.ga_agent_job_audit(),public.ga_agent_chat_settings_audit() from public,anon,authenticated;
grant execute on function public.ga_agent_job_audit(),public.ga_agent_chat_settings_audit() to service_role;
alter table public.ga_connections drop constraint ga_connections_id_check;
alter table public.ga_connections add constraint ga_connections_id_check check(id in('google','google_ads','google_ads_management','supabase_calls','supabase_crm','ai_advisor','agent_github'));
create or replace function public.ga_claim_agent_exchange(p_id uuid,p_account text,p_actor uuid,p_message text,p_observation_at timestamptz)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.ga_admins where user_id=p_actor) then raise exception 'Forbidden'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
 if exists(select 1 from public.ga_agent_exchanges where id=p_id) then return false; end if;
 if exists(select 1 from public.ga_agent_exchanges where actor=p_actor and state='pending' and created_at>now()-interval '5 minutes') then raise exception 'Chat request already running'; end if;
 if (select count(*) from public.ga_agent_exchanges where actor=p_actor and created_at>now()-interval '1 hour')>=30 then raise exception 'Hourly chat limit reached'; end if;
 insert into public.ga_agent_exchanges(id,account_id,actor,user_message,observation_at) values(p_id,p_account,p_actor,p_message,p_observation_at);
 return true;
end $$;
commit;
