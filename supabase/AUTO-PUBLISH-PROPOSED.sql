-- Additive publication storage. Existing ads and inventory data are preserved.
begin;
alter table public.ga_ads_control add column auto_publish_enabled boolean not null default false,
 add column auto_publish_authorization text,add column auto_publish_checked_at timestamptz,add column auto_publish_error text;
alter table public.ga_ads_control add constraint ga_ads_publication_authorized check(not auto_publish_enabled or auto_publish_authorization is not null);
create table public.ga_ads_publications(
 id text primary key check(id ~ '^[a-f0-9]{64}$'),account_id text not null references public.ga_ads_control(account_id),
 plan jsonb not null check(jsonb_typeof(plan)='object'),
 state text not null default 'prepared' check(state in('prepared','creating','submitted','active','paused','failed','uncertain')),
 version integer not null default 0 check(version>=0),pending_operation text check(pending_operation in('create','group_enable','group_pause')),
 group_resource text,ad_resource text,google_feedback jsonb,error_code text,request_id text,
 checked_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(group_resource is null or group_resource ~ ('^customers/'||account_id||'/adGroups/[0-9]{1,20}$')),
 check(ad_resource is null or ad_resource ~ ('^customers/'||account_id||'/adGroupAds/[0-9]{1,20}~[0-9]{1,20}$')),
 check(plan ?& array['key','account','campaignId','groupName','model','partType','productId','stock','draft','keywords','copyRulesVersion']),
 check(plan->>'key'=id and plan->>'account'=account_id),
 check(state not in('submitted','active','paused') or (group_resource is not null and ad_resource is not null))
);
create index ga_ads_publications_monitor on public.ga_ads_publications(account_id,checked_at nulls first);
create table public.ga_ads_publication_events(
 id bigint generated always as identity primary key,publication_id text not null references public.ga_ads_publications(id),
 account_id text not null references public.ga_ads_control(account_id),version integer not null,event text not null,
 details jsonb not null,created_at timestamptz not null default now(),unique(publication_id,version)
);
create index ga_ads_publication_events_recent on public.ga_ads_publication_events(account_id,id desc);
create function public.ga_ads_publication_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' and (new.id<>old.id or new.account_id<>old.account_id or new.plan is distinct from old.plan or (old.group_resource is not null and new.group_resource is distinct from old.group_resource) or (old.ad_resource is not null and new.ad_resource is distinct from old.ad_resource)) then raise exception 'Publication identity is immutable';end if;
 if TG_OP='INSERT' or (new.state,new.pending_operation,new.group_resource,new.ad_resource,new.google_feedback,new.error_code) is distinct from (old.state,old.pending_operation,old.group_resource,old.ad_resource,old.google_feedback,old.error_code) then
 insert into public.ga_ads_publication_events(publication_id,account_id,version,event,details) values(new.id,new.account_id,new.version,new.state,jsonb_build_object('operation',new.pending_operation,'error',new.error_code,'group',new.group_resource,'ad',new.ad_resource,'google',new.google_feedback));
 end if;
 return new;
end $$;
create trigger ga_ads_publication_audit after insert or update on public.ga_ads_publications for each row execute function public.ga_ads_publication_audit();
alter table public.ga_ads_publications enable row level security;
alter table public.ga_ads_publication_events enable row level security;
revoke all on public.ga_ads_publications,public.ga_ads_publication_events from public,anon,authenticated,service_role;
grant select,insert,update on public.ga_ads_publications to service_role;
grant select,insert on public.ga_ads_publication_events to service_role;
grant usage,select on sequence public.ga_ads_publication_events_id_seq to service_role;
revoke all on function public.ga_ads_publication_audit() from public,anon,authenticated;
grant execute on function public.ga_ads_publication_audit() to service_role;
create function public.ga_ads_publishing_settings_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.ga_ads_action_events(account_id,event,details) values(new.account_id,'automatic_publication_settings',jsonb_build_object('enabled',new.auto_publish_enabled,'authorization',new.auto_publish_authorization));return new;
end $$;
create trigger ga_ads_publishing_settings_audit after update of auto_publish_enabled,auto_publish_authorization on public.ga_ads_control for each row execute function public.ga_ads_publishing_settings_audit();
revoke all on function public.ga_ads_publishing_settings_audit() from public,anon,authenticated;
grant execute on function public.ga_ads_publishing_settings_audit() to service_role;
commit;
