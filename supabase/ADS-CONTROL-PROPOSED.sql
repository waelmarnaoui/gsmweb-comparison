-- PROPOSED, NOT APPLIED. Attribution database only. No inventory schema changes.
-- Requires existing ga_admins and auth.users. Installs disabled control settings.
begin;
create table public.ga_ads_control(
 account_id text primary key check(account_id ~ '^[0-9]{10}$'),
 stock_enabled boolean not null default false,global_paused boolean not null default true,
 version text not null default 'stock-control-v1',approved_by uuid references auth.users(id),approved_at timestamptz,recovery_deployment_id text check(length(recovery_deployment_id)<=100),
 lock_token uuid,lock_until timestamptz,
 check(not stock_enabled or (approved_by is not null and approved_at is not null))
);
create table public.ga_ads_product_ads(
 account_id text not null references public.ga_ads_control(account_id),resource_name text not null,
 campaign_id text not null check(campaign_id ~ '^[0-9]{1,20}$'),product_id text not null check(length(product_id) between 1 and 200),
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),evidence jsonb not null check(jsonb_typeof(evidence)='object'),active boolean not null default true,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(account_id,resource_name),
 check(resource_name ~ ('^customers/' || account_id || '/adGroupAds/[0-9]{1,20}~[0-9]{1,20}$'))
);
create table public.ga_ads_actions(
 id uuid primary key default gen_random_uuid(),account_id text not null references public.ga_ads_control(account_id),
 kind text not null check(kind in('ad_status','campaign_pause','budget_decrease')),resource_name text not null,
 before_value text not null,after_value text not null,source text not null check(source in('owner','stock')),
 product_id text,inventory_fingerprint text,google_fingerprint text,reason text not null check(length(reason) between 1 and 500),
 state text not null default 'proposed' check(state in('proposed','approved','executing','confirmed','uncertain','failed','conflict','expired','recovered','cancelled')),
 created_by uuid references auth.users(id),approved_by uuid references auth.users(id),cancelled_by uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 minutes',
 started_at timestamptz,recovery_due_at timestamptz,request_id text,error_code text,
 idempotency_key text not null check(idempotency_key ~ '^[a-f0-9]{64}$'),unique(account_id,idempotency_key),
 check(source!='stock' or (kind='ad_status' and before_value='ENABLED' and after_value='PAUSED' and product_id is not null and inventory_fingerprint is not null)),
 check(source!='owner' or created_by is not null),
 check(kind!='ad_status' or after_value!='ENABLED' or (google_fingerprint is not null and google_fingerprint ~ '^[a-f0-9]{64}$')),
 check(state not in('approved','executing','confirmed','recovered') or source='stock' or approved_by is not null),
 check(kind!='campaign_pause' or state not in('executing','confirmed','uncertain','recovered') or (started_at is not null and recovery_due_at is not null and recovery_due_at>=started_at and recovery_due_at<=started_at+interval '8 minutes')),
 check((kind='ad_status' and resource_name ~ ('^customers/' || account_id || '/adGroupAds/[0-9]{1,20}~[0-9]{1,20}$') and before_value in('ENABLED','PAUSED') and after_value in('ENABLED','PAUSED') and before_value<>after_value)
 or (kind='campaign_pause' and resource_name ~ ('^customers/' || account_id || '/campaigns/[0-9]{1,20}$') and before_value='ENABLED' and after_value='PAUSED')
 or (kind='budget_decrease' and resource_name ~ ('^customers/' || account_id || '/campaignBudgets/[0-9]{1,20}$') and before_value ~ '^[1-9][0-9]{0,14}$' and after_value ~ '^[1-9][0-9]{0,14}$' and after_value::numeric<before_value::numeric))
);
create index ga_ads_actions_pending on public.ga_ads_actions(account_id,state,created_at);
create unique index ga_ads_actions_one_inflight on public.ga_ads_actions(account_id,resource_name) where state in('approved','executing','uncertain');
create unique index ga_ads_actions_one_campaign_lease on public.ga_ads_actions(account_id) where kind='campaign_pause' and state in('executing','uncertain','confirmed');
create index ga_ads_actions_recovery on public.ga_ads_actions(recovery_due_at) where recovery_due_at is not null and state in('executing','uncertain','confirmed');
create table public.ga_ads_control_workers(
 account_id text not null references public.ga_ads_control(account_id),role text not null check(role in('monitor','recovery')),
 deployment_id text not null check(length(deployment_id) between 1 and 100),version text not null,
 checked_at timestamptz not null default now(),ok boolean not null,primary key(account_id,role,deployment_id)
);
create table public.ga_ads_action_events(
 id bigint generated always as identity primary key,account_id text not null,
 action_id uuid references public.ga_ads_actions(id),actor uuid references auth.users(id),
 event text not null,details jsonb not null,created_at timestamptz not null default now()
);
-- Only setup/runtime capability hashes are stored. No bootstrap credentials are stored here.
create table public.ga_ads_worker_pairings(
 id uuid primary key,account_id text not null references public.ga_ads_control(account_id),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 deployment_id text not null check(length(deployment_id) between 1 and 100),
 canary_campaign_id text not null check(canary_campaign_id ~ '^[0-9]{1,20}$'),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '10 minutes',
 claimed_at timestamptz
);
create index ga_ads_action_events_history on public.ga_ads_action_events(account_id,id desc);
create index ga_ads_control_approver on public.ga_ads_control(approved_by);
create index ga_ads_product_ads_creator on public.ga_ads_product_ads(created_by);
create index ga_ads_actions_creator on public.ga_ads_actions(created_by);
create index ga_ads_actions_approver on public.ga_ads_actions(approved_by);
create index ga_ads_actions_canceller on public.ga_ads_actions(cancelled_by);
create index ga_ads_events_action on public.ga_ads_action_events(action_id);
create index ga_ads_events_actor on public.ga_ads_action_events(actor);
create index ga_ads_pairing_creator on public.ga_ads_worker_pairings(created_by);
create index ga_ads_pairing_account on public.ga_ads_worker_pairings(account_id);
alter table public.ga_ads_control enable row level security;
alter table public.ga_ads_product_ads enable row level security;
alter table public.ga_ads_actions enable row level security;
alter table public.ga_ads_control_workers enable row level security;
alter table public.ga_ads_action_events enable row level security;
alter table public.ga_ads_worker_pairings enable row level security;
revoke all on public.ga_ads_control,public.ga_ads_product_ads,public.ga_ads_actions,public.ga_ads_control_workers,public.ga_ads_action_events from public,anon,authenticated,service_role;
grant select,insert,update on public.ga_ads_control,public.ga_ads_product_ads,public.ga_ads_actions,public.ga_ads_control_workers to service_role;
grant select,insert on public.ga_ads_action_events to service_role;
grant usage,select on sequence public.ga_ads_action_events_id_seq to service_role;
revoke all on public.ga_ads_worker_pairings from public,anon,authenticated,service_role;
grant select,insert,update on public.ga_ads_worker_pairings to service_role;
-- Invoker functions are callable only by the server role and never elevate callers.
create function public.ga_ads_control_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.ga_ads_action_events(account_id,action_id,actor,event,details)
 values(new.account_id,case when tg_table_name='ga_ads_actions' then (to_jsonb(new)->>'id')::uuid else null end,
 coalesce((to_jsonb(new)->>'cancelled_by')::uuid,(to_jsonb(new)->>'approved_by')::uuid,(to_jsonb(new)->>'created_by')::uuid),tg_table_name||':'||tg_op,
 jsonb_build_object('before',case when tg_op='UPDATE' then to_jsonb(old)-'lock_token'-'lock_until' else null end,'after',to_jsonb(new)-'lock_token'-'lock_until'));
 return new;
end $$;
create trigger ga_ads_actions_audit after insert or update on public.ga_ads_actions for each row execute function public.ga_ads_control_audit();
create trigger ga_ads_mappings_audit after insert or update on public.ga_ads_product_ads for each row execute function public.ga_ads_control_audit();
create trigger ga_ads_pairings_audit after insert or update on public.ga_ads_worker_pairings for each row execute function public.ga_ads_control_audit();
-- Lock-only updates generate no noisy settings audit events.
create trigger ga_ads_settings_insert_audit after insert on public.ga_ads_control for each row execute function public.ga_ads_control_audit();
create trigger ga_ads_settings_update_audit after update of stock_enabled,global_paused,version,approved_by,approved_at,recovery_deployment_id on public.ga_ads_control for each row execute function public.ga_ads_control_audit();
create function public.ga_ads_control_lock(p_account text) returns uuid language plpgsql security invoker set search_path='' as $$
declare token uuid:=gen_random_uuid();
begin
 update public.ga_ads_control set lock_token=token,lock_until=clock_timestamp()+interval '90 seconds'
 where account_id=p_account and (lock_until is null or lock_until<clock_timestamp());
 if not found then return null; end if;return token;
end $$;
create function public.ga_ads_control_unlock(p_account text,p_token uuid) returns void language sql security invoker set search_path='' as $$
 update public.ga_ads_control set lock_token=null,lock_until=null where account_id=p_account and lock_token=p_token;
$$;
create function public.ga_ads_control_renew(p_account text,p_token uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.ga_ads_control set lock_until=clock_timestamp()+interval '90 seconds' where account_id=p_account and lock_token=p_token and lock_until>clock_timestamp();
 return found;
end $$;
revoke all on function public.ga_ads_control_audit(),public.ga_ads_control_lock(text),public.ga_ads_control_unlock(text,uuid),public.ga_ads_control_renew(text,uuid) from public,anon,authenticated;
grant execute on function public.ga_ads_control_audit(),public.ga_ads_control_lock(text),public.ga_ads_control_unlock(text,uuid),public.ga_ads_control_renew(text,uuid) to service_role;
commit;
