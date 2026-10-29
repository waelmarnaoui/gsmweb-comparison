-- Approved scope: attribution database only. No CRM or Google mutations.
begin;
create table public.ga_pmax_drafts(
 id uuid primary key default gen_random_uuid(),account_id text not null,actor uuid not null references auth.users(id),
 input jsonb not null,draft jsonb,content_hash text,
 state text not null default 'generating' check(state in ('generating','failed','draft','validating','submitting','submitted','uncertain','rejected')),
 version integer not null default 0,result jsonb,error_code text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(octet_length(input::text)<20000),check(draft is null or octet_length(draft::text)<100000),
 check(content_hash is null or content_hash~'^[a-f0-9]{64}$')
);
create index ga_pmax_actor on public.ga_pmax_drafts(account_id,actor,created_at desc);
alter table public.ga_pmax_drafts enable row level security;
revoke all on public.ga_pmax_drafts from public,anon,authenticated,service_role;
grant select,insert on public.ga_pmax_drafts to service_role;
grant update(draft,content_hash,state,version,result,error_code,updated_at) on public.ga_pmax_drafts to service_role;
create function public.ga_pmax_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' and (new.state<>'generating' or new.version<>0) then raise exception 'PMax begins as generating';end if;
 if TG_OP='UPDATE' then
  if (new.id,new.account_id,new.actor,new.input,new.created_at) is distinct from (old.id,old.account_id,old.actor,old.input,old.created_at) then raise exception 'PMax identity immutable';end if;
  if new.version<>old.version+1 then raise exception 'PMax version conflict';end if;
  if old.state not in ('generating','draft') and (new.draft is distinct from old.draft or new.content_hash is distinct from old.content_hash) then raise exception 'Submitted PMax immutable';end if;
  if not ((old.state='generating' and new.state in ('draft','failed')) or (old.state='draft' and new.state in ('draft','validating')) or (old.state='validating' and new.state in ('submitting','rejected')) or (old.state='submitting' and new.state in ('submitted','uncertain','rejected'))) then raise exception 'Invalid PMax transition';end if;
 end if;
 insert into public.ga_audit(actor,action,entity,record_id,details) values(new.actor,new.state,'pmax_campaign',new.id::text,jsonb_build_object('account',new.account_id,'hash',new.content_hash,'version',new.version,'error',new.error_code,'requested_status','ENABLED'));
 return new;
end $$;
create trigger ga_pmax_audit after insert or update on public.ga_pmax_drafts for each row execute function public.ga_pmax_audit();
revoke all on function public.ga_pmax_audit() from public,anon,authenticated;
grant execute on function public.ga_pmax_audit() to service_role;
notify pgrst,'reload schema';
commit;
