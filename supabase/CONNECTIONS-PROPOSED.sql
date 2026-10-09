-- Approval required. Run only in the current attribution/auth database.
-- Creates new app-owned tables; never modifies existing CRM tables.
begin;
create table if not exists public.ga_connections (
 id text primary key check (id in ('google','supabase_calls','supabase_crm')),
 encrypted_credentials text not null,
 metadata jsonb not null default '{}'::jsonb,
 connected_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.ga_connections enable row level security;
revoke all on public.ga_connections from public, anon, authenticated;
grant select,insert,update,delete on public.ga_connections to service_role;
create table if not exists public.ga_connection_audit (
 id bigint generated always as identity primary key,
 actor uuid not null references auth.users(id),
 connection text not null,
 action text not null,
 created_at timestamptz not null default now()
);
alter table public.ga_connection_audit enable row level security;
revoke all on public.ga_connection_audit from public, anon, authenticated;
grant select,insert on public.ga_connection_audit to service_role;
grant usage,select on sequence public.ga_connection_audit_id_seq to service_role;
create or replace function public.ga_log_connection_change() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 insert into public.ga_connection_audit(actor,connection,action)
 values(new.connected_by,new.id,case when TG_OP='INSERT' then 'connected' else 'updated' end);
 return new;
end $$;
revoke all on function public.ga_log_connection_change() from public,anon,authenticated;
create trigger ga_connection_change after insert or update on public.ga_connections
for each row execute function public.ga_log_connection_change();
create or replace function public.ga_disconnect_connection(p_id text,p_actor uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 delete from public.ga_connections where id=p_id;
 if found then
  insert into public.ga_connection_audit(actor,connection,action) values(p_actor,p_id,'disconnected');
 end if;
end $$;
revoke all on function public.ga_disconnect_connection(text,uuid) from public,anon,authenticated;
grant execute on function public.ga_disconnect_connection(text,uuid) to service_role;
commit;
