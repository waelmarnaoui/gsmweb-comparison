-- App-owned consent history only. Separate CRM tables remain unchanged.
begin;
create table if not exists public.ga_client_consents(
 id bigint generated always as identity primary key,
 crm_project_ref text not null,
 client_id text not null,
 phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'),
 ad_user_data text not null check(ad_user_data in ('not_asked','granted','refused','withdrawn')),
 ad_personalization text not null check(ad_personalization in ('not_asked','granted','refused','withdrawn')),
 obtained_at timestamptz not null,
 recorded_at timestamptz not null default clock_timestamp(),
 recorded_by uuid not null references auth.users(id),
 script_version text not null,
 source text not null default 'store_verbal' check(source='store_verbal')
);
create index if not exists ga_client_consents_subject on public.ga_client_consents(crm_project_ref,client_id,id desc);
alter table public.ga_client_consents enable row level security;
drop policy if exists admin_read on public.ga_client_consents;
create policy admin_read on public.ga_client_consents for select to authenticated using(public.ga_is_admin());
revoke all on public.ga_client_consents from public,anon,authenticated,service_role;
grant select on public.ga_client_consents to authenticated,service_role;
create or replace function public.ga_record_client_consent(p_project text,p_client text,p_phone text,p_measurement text,p_personalization text,p_obtained timestamptz,p_version text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.ga_is_admin() then raise exception 'Forbidden';end if;
 if p_project !~ '^[a-z]{20}$' or length(p_client) not between 1 and 200 or p_obtained is null or p_obtained>clock_timestamp() or p_version<>'store-google-v1' then raise exception 'Invalid consent record';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_project||':'||p_client,0));
 insert into public.ga_client_consents(crm_project_ref,client_id,phone,ad_user_data,ad_personalization,obtained_at,recorded_by,script_version)
 values(p_project,p_client,p_phone,p_measurement,p_personalization,p_obtained,auth.uid(),p_version);
end $$;
revoke all on function public.ga_record_client_consent(text,text,text,text,text,timestamptz,text) from public,anon,service_role;
grant execute on function public.ga_record_client_consent(text,text,text,text,text,timestamptz,text) to authenticated;
drop trigger if exists ga_client_consents_audit on public.ga_client_consents;
create trigger ga_client_consents_audit after insert on public.ga_client_consents for each row execute function public.ga_audit_change();
notify pgrst,'reload schema';
commit;
