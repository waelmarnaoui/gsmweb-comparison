-- App-owned attribution database only. Approval required before applying.
begin;
create table if not exists public.ga_keyword_reports(
 id uuid primary key default gen_random_uuid(),actor uuid not null references auth.users(id),account_id text not null,
 range_start date not null,range_end date not null,payload jsonb not null,created_at timestamptz not null default now()
);
create index if not exists ga_keyword_report_lookup on public.ga_keyword_reports(account_id,range_start,range_end,created_at desc);
create table if not exists public.ga_keyword_actions(
 id uuid primary key default gen_random_uuid(),actor uuid not null references auth.users(id),account_id text not null,
 content_hash text not null check(length(content_hash)=64),payload jsonb not null,
 state text not null default 'draft' check(state in('draft','submitting','success','failed','uncertain')),
 result jsonb,error_code text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(account_id,content_hash)
);
create index if not exists ga_keyword_action_pending on public.ga_keyword_actions(account_id,state);
alter table public.ga_keyword_reports enable row level security;
alter table public.ga_keyword_actions enable row level security;
revoke all on public.ga_keyword_reports,public.ga_keyword_actions from public,anon,authenticated;
grant select on public.ga_keyword_reports,public.ga_keyword_actions to authenticated;
grant select,insert on public.ga_keyword_reports to service_role;
grant select,insert,update on public.ga_keyword_actions to service_role;
drop policy if exists admin_read on public.ga_keyword_reports;
drop policy if exists admin_read on public.ga_keyword_actions;
create policy admin_read on public.ga_keyword_reports for select to authenticated using(public.ga_is_admin());
create policy admin_read on public.ga_keyword_actions for select to authenticated using(public.ga_is_admin());
create or replace function public.ga_keyword_action_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if new.actor<>old.actor or new.account_id<>old.account_id or new.content_hash<>old.content_hash or new.payload<>old.payload or new.created_at<>old.created_at then raise exception 'Keyword intent is immutable';end if;
 if not ((old.state='draft' and new.state='submitting') or (old.state='submitting' and new.state in('success','failed','uncertain'))) then raise exception 'Invalid keyword state transition';end if;
 return new;
end $$;
revoke all on function public.ga_keyword_action_guard() from public,anon,authenticated;
drop trigger if exists ga_keyword_action_guard on public.ga_keyword_actions;
create trigger ga_keyword_action_guard before update on public.ga_keyword_actions for each row execute function public.ga_keyword_action_guard();
drop trigger if exists ga_keyword_action_audit on public.ga_keyword_actions;
create trigger ga_keyword_action_audit after insert or update on public.ga_keyword_actions for each row execute function public.ga_audit_change();
alter table public.ga_connections drop constraint if exists ga_connections_id_check;
alter table public.ga_connections add constraint ga_connections_id_check check(id in('google','google_ads','google_ads_management','google_search_console','supabase_calls','supabase_crm','ai_advisor','agent_github'));
commit;
