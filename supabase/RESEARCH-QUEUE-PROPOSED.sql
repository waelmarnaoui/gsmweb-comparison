begin;
create table public.ga_research_workers(
 id uuid primary key default gen_random_uuid(),
 account_id text not null references public.ga_ads_control(account_id),
 actor uuid not null references auth.users(id),
 label text not null check(length(label) between 1 and 100),
 token_hash text unique not null check(token_hash ~ '^[a-f0-9]{64}$'),
 active boolean not null default true,
 created_at timestamptz not null default now(),last_seen_at timestamptz
);
create index ga_research_workers_owner on public.ga_research_workers(account_id,actor);
create index ga_research_workers_actor on public.ga_research_workers(actor);
create table public.ga_research_tasks(
 id uuid primary key default gen_random_uuid(),
 account_id text not null references public.ga_ads_control(account_id),
 actor uuid not null references auth.users(id),
 kind text not null check(kind in('keywords','competitors','general')),
 title text not null check(length(title) between 3 and 200),
 instructions text not null check(length(instructions) between 3 and 12000),
 state text not null default 'queued' check(state in('queued','running','paused','completed','failed','cancelled')),
 input jsonb not null default '{}' check(jsonb_typeof(input)='object' and octet_length(input::text)<=2000000),
 checkpoint jsonb not null default '{}' check(jsonb_typeof(checkpoint)='object' and octet_length(checkpoint::text)<=500000),
 checkpoint_version integer not null default 0 check(checkpoint_version>=0),
 report jsonb check(report is null or jsonb_typeof(report)='object' and octet_length(report::text)<=500000),
 worker_id uuid references public.ga_research_workers(id),lease_token uuid,lease_until timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 deadline_at timestamptz not null default now()+interval '12 hours',error_code text,
 check(deadline_at>created_at and deadline_at<=created_at+interval '24 hours')
);
create index ga_research_tasks_queue on public.ga_research_tasks(account_id,actor,state,created_at);
create index ga_research_tasks_worker on public.ga_research_tasks(worker_id);
create index ga_research_tasks_actor on public.ga_research_tasks(actor);
alter table public.ga_research_workers enable row level security;
alter table public.ga_research_tasks enable row level security;
revoke all on public.ga_research_workers,public.ga_research_tasks from public,anon,authenticated,service_role;
grant select on public.ga_research_tasks to authenticated;
create policy research_owner_read on public.ga_research_tasks for select to authenticated
 using(actor=(select auth.uid()) and public.ga_is_admin());
grant select,insert on public.ga_research_workers,public.ga_research_tasks to service_role;
grant update(active,last_seen_at) on public.ga_research_workers to service_role;
grant update(state,checkpoint,checkpoint_version,report,worker_id,lease_token,lease_until,updated_at,error_code) on public.ga_research_tasks to service_role;

create function public.ga_research_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.ga_audit(actor,action,entity,record_id,details) values(new.actor,TG_OP,'research_task',new.id::text,jsonb_build_object('state',new.state,'checkpoint_version',new.checkpoint_version,'worker_id',new.worker_id,'error_code',new.error_code));
 return new;
end $$;
create trigger ga_research_audit after insert or update of state,checkpoint_version on public.ga_research_tasks for each row execute function public.ga_research_audit();

create function public.ga_research_claim(p_worker uuid) returns setof public.ga_research_tasks
language plpgsql security invoker set search_path='' as $$
declare w public.ga_research_workers%rowtype;t public.ga_research_tasks%rowtype;
begin
 select * into w from public.ga_research_workers where id=p_worker and active for update;
 if not found or not exists(select 1 from public.ga_admins where user_id=w.actor) then return;end if;
 update public.ga_research_workers set last_seen_at=now() where id=p_worker;
 update public.ga_research_tasks set state='failed',error_code='deadline_exceeded',lease_until=null,updated_at=now()
  where account_id=w.account_id and actor=w.actor and state in('queued','running') and deadline_at<=now();
 if exists(select 1 from public.ga_research_tasks where worker_id=p_worker and state='running' and lease_until>now()) then return;end if;
 select * into t from public.ga_research_tasks where account_id=w.account_id and actor=w.actor
  and deadline_at>now() and (state='queued' or state='running' and lease_until<=now())
  order by created_at,id for update skip locked limit 1;
 if not found then return;end if;
 return query update public.ga_research_tasks set state='running',worker_id=p_worker,lease_token=gen_random_uuid(),lease_until=least(now()+interval '3 minutes',deadline_at),updated_at=now()
  where id=t.id returning *;
end $$;

create function public.ga_research_heartbeat(p_worker uuid,p_task uuid,p_lease uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
 update public.ga_research_tasks t set lease_until=least(now()+interval '3 minutes',t.deadline_at),updated_at=now()
 where t.id=p_task and t.worker_id=p_worker and t.lease_token=p_lease and t.state='running' and t.lease_until>now() and t.deadline_at>now()
 and exists(select 1 from public.ga_research_workers w join public.ga_admins a on a.user_id=w.actor where w.id=p_worker and w.active and w.actor=t.actor and w.account_id=t.account_id);
 get diagnostics changed=row_count;return changed=1;
end $$;

create function public.ga_research_checkpoint(p_worker uuid,p_task uuid,p_lease uuid,p_version integer,p_checkpoint jsonb,p_report jsonb,p_finish boolean) returns boolean
language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
 update public.ga_research_tasks t set checkpoint=p_checkpoint,checkpoint_version=t.checkpoint_version+1,
 report=case when p_finish then p_report else t.report end,state=case when p_finish then 'completed' else 'running' end,
 lease_until=case when p_finish then null else least(now()+interval '3 minutes',t.deadline_at) end,updated_at=now()
 where t.id=p_task and t.worker_id=p_worker and t.lease_token=p_lease and t.checkpoint_version=p_version and t.state='running'
 and t.lease_until>now() and t.deadline_at>now() and (not p_finish or p_report is not null)
 and exists(select 1 from public.ga_research_workers w join public.ga_admins a on a.user_id=w.actor where w.id=p_worker and w.active and w.actor=t.actor and w.account_id=t.account_id);
 get diagnostics changed=row_count;return changed=1;
end $$;
revoke all on function public.ga_research_audit(),public.ga_research_claim(uuid),public.ga_research_heartbeat(uuid,uuid,uuid),public.ga_research_checkpoint(uuid,uuid,uuid,integer,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.ga_research_audit(),public.ga_research_claim(uuid),public.ga_research_heartbeat(uuid,uuid,uuid),public.ga_research_checkpoint(uuid,uuid,uuid,integer,jsonb,jsonb,boolean) to service_role;
commit;
