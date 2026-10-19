-- Attribution database only. Review and approve before installation. CRM is untouched.
begin;
create table public.ga_bulk_ad_groups (
 id uuid primary key default gen_random_uuid(),
 account_id text not null references public.ga_ads_control(account_id),
 actor uuid not null references auth.users(id),
 campaign_id text not null check(campaign_id ~ '^[0-9]{1,20}$'),
 family text not null check(family in ('iphone','samsung-s','samsung-a','xiaomi','huawei','motorola','honor','oneplus','oppo')),
 service text not null check(service in ('battery','display','camera','charging','glass')),
 draft jsonb not null check(jsonb_typeof(draft->'ads')='array' and jsonb_array_length(draft->'ads') between 1 and 3 and octet_length(draft::text)<400000),
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 cpc_micros text check(cpc_micros ~ '^[0-9]{1,9}$'),
 state text not null default 'draft' check(state in ('draft','validating','submitting','submitted','uncertain','rejected')),
 version integer not null default 0 check(version>=0),
 result jsonb,error_code text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(account_id,campaign_id,family,service)
);
create index ga_bulk_ads_actor on public.ga_bulk_ad_groups(actor,created_at desc);
alter table public.ga_bulk_ad_groups enable row level security;
revoke all on public.ga_bulk_ad_groups from public,anon,authenticated,service_role;
grant select,insert on public.ga_bulk_ad_groups to service_role;
grant update(draft,content_hash,cpc_micros,state,version,result,error_code,updated_at) on public.ga_bulk_ad_groups to service_role;
create function public.ga_bulk_ad_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' and (new.state<>'draft' or new.version<>0) then raise exception 'New bulk groups must start as drafts';end if;
 if TG_OP='UPDATE' then
  if new.id<>old.id or new.account_id<>old.account_id or new.actor<>old.actor or new.campaign_id<>old.campaign_id or new.family<>old.family or new.service<>old.service or new.created_at<>old.created_at then raise exception 'Bulk identity is immutable';end if;
  if new.version<>old.version+1 then raise exception 'Bulk version conflict';end if;
  if old.state not in ('draft','rejected') and (new.draft is distinct from old.draft or new.content_hash<>old.content_hash or new.cpc_micros is distinct from old.cpc_micros) then raise exception 'Submitted copy is immutable';end if;
  if not ((old.state in ('draft','rejected') and new.state='draft') or (old.state='draft' and new.state='validating') or (old.state='validating' and new.state in ('submitting','rejected')) or (old.state='submitting' and new.state in ('submitted','uncertain','rejected'))) then raise exception 'Invalid bulk state transition';end if;
 end if;
 insert into public.ga_audit(actor,action,entity,record_id,details) values(new.actor,new.state,'bulk_ad_group',new.id::text,jsonb_build_object('account',new.account_id,'campaign',new.campaign_id,'hash',new.content_hash,'version',new.version,'error',new.error_code));
 return new;
end $$;
create trigger ga_bulk_ad_audit after insert or update on public.ga_bulk_ad_groups for each row execute function public.ga_bulk_ad_audit();
revoke all on function public.ga_bulk_ad_audit() from public,anon,authenticated;
grant execute on function public.ga_bulk_ad_audit() to service_role;
commit;
