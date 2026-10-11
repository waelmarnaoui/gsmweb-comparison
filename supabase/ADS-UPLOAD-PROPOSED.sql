-- Attribution database only. No CRM writes or automatic uploads.
begin;
create table if not exists public.ga_ads_uploads(
 account_id text not null check(account_id='2050434247'),
 conversion_id text not null check(conversion_id='7835048106'),
 payment_id text not null,
 payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
 consent_id bigint not null references public.ga_client_consents(id),
 batch_id uuid not null,
 created_by uuid not null references auth.users(id),
 state text not null default 'sending' check(state in ('sending','submitted','unknown','success','failed','partial')),
 request_id text,
 warning boolean not null default false,
 error_codes text[] not null default '{}',
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(account_id,conversion_id,payment_id)
);
create index if not exists ga_ads_uploads_batch on public.ga_ads_uploads(batch_id);
alter table public.ga_ads_uploads enable row level security;
drop policy if exists admin_read on public.ga_ads_uploads;
create policy admin_read on public.ga_ads_uploads for select to authenticated using(public.ga_is_admin());
revoke all on public.ga_ads_uploads from public,anon,authenticated,service_role;
grant select on public.ga_ads_uploads to authenticated;
grant select,insert,update on public.ga_ads_uploads to service_role;
create or replace function public.ga_claim_ads_upload(p_actor uuid,p_items jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare batch uuid:=gen_random_uuid();item jsonb;c public.ga_client_consents%rowtype;
begin
 if not exists(select 1 from public.ga_admins where user_id=p_actor) then raise exception 'Forbidden';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Invalid batch';end if;
 if jsonb_array_length(p_items) not between 1 and 2000 then raise exception 'Invalid batch';end if;
 -- All claims in a batch commit together; concurrent clicks cannot claim the same payment.
 for item in select value from jsonb_array_elements(p_items) order by value->>'payment_id' loop
  select * into c from public.ga_client_consents where id=(item->>'consent_id')::bigint;
  if not found then raise exception 'Consent unavailable';end if;
  perform pg_advisory_xact_lock(hashtextextended(c.crm_project_ref||':'||c.client_id,0));
  select * into c from public.ga_client_consents where crm_project_ref=c.crm_project_ref and client_id=c.client_id order by id desc limit 1;
  if c.id<>(item->>'consent_id')::bigint or c.ad_user_data<>'granted' or c.script_version<>'store-google-v1' or c.obtained_at>clock_timestamp() or left(item->>'payment_id',21)<>c.crm_project_ref||':' then raise exception 'Consent changed';end if;
  if length(item->>'payment_id') not between 1 and 250 then raise exception 'Invalid payment';end if;
  insert into public.ga_ads_uploads(account_id,conversion_id,payment_id,payload_hash,consent_id,batch_id,created_by)
   values('2050434247','7835048106',item->>'payment_id',item->>'payload_hash',c.id,batch,p_actor);
 end loop;
 return batch;
end $$;
revoke all on function public.ga_claim_ads_upload(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ga_claim_ads_upload(uuid,jsonb) to service_role;
drop trigger if exists ga_ads_uploads_audit on public.ga_ads_uploads;
create trigger ga_ads_uploads_audit after insert or update on public.ga_ads_uploads for each row execute function public.ga_audit_change();
notify pgrst,'reload schema';
commit;
