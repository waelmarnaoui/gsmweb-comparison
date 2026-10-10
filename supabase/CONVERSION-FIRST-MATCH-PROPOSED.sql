-- App-owned first paid-customer match times only. No CRM changes or draft rewrites.
begin;
create table if not exists public.ga_conversion_observations(
 id uuid primary key default gen_random_uuid(),
 payment_transaction_id text unique not null,
 call_id uuid not null references public.ga_calls(id),
 crm_paid_date date not null,
 first_matched_at timestamptz not null default clock_timestamp()
);
alter table public.ga_conversion_observations enable row level security;
drop policy if exists admin_read on public.ga_conversion_observations;
create policy admin_read on public.ga_conversion_observations for select to authenticated using(public.ga_is_admin());
revoke all on public.ga_conversion_observations from public,anon,authenticated,service_role;
grant select on public.ga_conversion_observations to authenticated;
grant select on public.ga_conversion_observations to service_role;
grant insert(payment_transaction_id,call_id,crm_paid_date) on public.ga_conversion_observations to service_role;
drop trigger if exists ga_conversion_observations_audit on public.ga_conversion_observations;
create trigger ga_conversion_observations_audit after insert on public.ga_conversion_observations for each row execute function public.ga_audit_change();
notify pgrst,'reload schema';
commit;

