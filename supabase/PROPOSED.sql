-- REVIEW ONLY. Do not run against production without explicit approval.
-- All objects are new, ga_-prefixed. No existing CRM tables are changed.
begin;
create table public.ga_admins(user_id uuid primary key references auth.users(id));
create function public.ga_is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from ga_admins where user_id=auth.uid()) $$;
revoke all on function public.ga_is_admin() from public;
grant execute on function public.ga_is_admin() to authenticated;
create table public.ga_settings(id integer primary key check(id=1),window_seconds integer not null default 120 check(window_seconds between 1 and 3600));
insert into public.ga_settings values(1,120);
create table public.ga_devices(id uuid primary key default gen_random_uuid(),name text not null,token_hash text unique not null,active boolean not null default true);
create table public.ga_clicks(id uuid primary key default gen_random_uuid(),source_key text unique not null,clicked_at timestamptz not null,gclid text,campaign text,page_url text,session_id text,created_at timestamptz not null default now());
create table public.ga_calls(id uuid primary key default gen_random_uuid(),device_id uuid not null references public.ga_devices(id),external_id text not null,phone text not null check(phone ~ '^\+40[0-9]{9}$'),started_at timestamptz not null,duration_seconds integer not null check(duration_seconds between 0 and 86400),direction text not null check(direction in ('incoming','outgoing','missed')),created_at timestamptz not null default now(),unique(device_id,external_id));
create index ga_calls_time on public.ga_calls(started_at);
create index ga_clicks_time on public.ga_clicks(clicked_at);
create table public.ga_matches(id uuid primary key default gen_random_uuid(),call_id uuid unique not null references public.ga_calls(id),click_id uuid unique not null references public.ga_clicks(id),confirmed_by uuid not null references auth.users(id),confirmed_at timestamptz not null default now());
-- CRM IDs use text until the actual primary-key types and relationships are inspected.
create table public.ga_customer_links(call_id uuid primary key references public.ga_calls(id),client_id text not null,verified_by uuid not null references auth.users(id),verified_at timestamptz not null default now());
create table public.ga_conversion_drafts(id uuid primary key default gen_random_uuid(),match_id uuid not null references public.ga_matches(id),payment_transaction_id text unique not null,amount numeric(14,2) not null check(amount>0),currency text not null default 'RON' check(currency='RON'),paid_at timestamptz not null,gclid text not null,status text not null default 'prepared' check(status in ('prepared','exported','void')),created_at timestamptz not null default now());
create table public.ga_audit(id bigint generated always as identity primary key,actor uuid,action text not null,entity text not null,record_id text,details jsonb not null default '{}',created_at timestamptz not null default now());
create function public.ga_audit_change() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into ga_audit(actor,action,entity,record_id,details) values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(to_jsonb(NEW)->>'id',to_jsonb(NEW)->>'call_id'),jsonb_build_object('before',case when TG_OP='UPDATE' then to_jsonb(OLD) else null end,'after',to_jsonb(NEW)));return NEW;end $$;
create trigger ga_settings_audit after update on public.ga_settings for each row execute function public.ga_audit_change();
create trigger ga_matches_audit after insert on public.ga_matches for each row execute function public.ga_audit_change();
create trigger ga_links_audit after insert or update on public.ga_customer_links for each row execute function public.ga_audit_change();
create trigger ga_drafts_audit after insert or update on public.ga_conversion_drafts for each row execute function public.ga_audit_change();
create trigger ga_calls_audit after insert on public.ga_calls for each row execute function public.ga_audit_change();
create trigger ga_clicks_audit after insert on public.ga_clicks for each row execute function public.ga_audit_change();
create function public.ga_confirm_match(p_call uuid,p_click uuid) returns uuid language plpgsql security definer set search_path=public as $$ declare result uuid;begin
 if not ga_is_admin() then raise exception 'Forbidden';end if;
 if not exists(select 1 from ga_calls c cross join ga_clicks k cross join ga_settings s where c.id=p_call and k.id=p_click and c.direction='incoming' and k.clicked_at<=c.started_at and c.started_at-k.clicked_at<=make_interval(secs=>s.window_seconds)) then raise exception 'Outside matching window';end if;
 insert into ga_matches(call_id,click_id,confirmed_by) values(p_call,p_click,auth.uid()) returning id into result;return result;end $$;
revoke all on function public.ga_confirm_match(uuid,uuid) from public;
grant execute on function public.ga_confirm_match(uuid,uuid) to authenticated;
create view public.ga_candidates with (security_invoker=true) as select c.id call_id,k.id click_id,extract(epoch from c.started_at-k.clicked_at)::integer delay_seconds,count(*) over(partition by c.id) candidate_count from public.ga_calls c join public.ga_clicks k on k.clicked_at<=c.started_at cross join public.ga_settings s where c.direction='incoming' and c.started_at-k.clicked_at<=make_interval(secs=>s.window_seconds) and not exists(select 1 from public.ga_matches m where m.call_id=c.id or m.click_id=k.id);
alter table public.ga_admins enable row level security;
create policy ga_admin_self on public.ga_admins for select to authenticated using(user_id=auth.uid());
do $$ declare t text;begin foreach t in array array['ga_settings','ga_devices','ga_clicks','ga_calls','ga_matches','ga_customer_links','ga_conversion_drafts','ga_audit'] loop execute format('alter table public.%I enable row level security',t);execute format('create policy admin_read on public.%I for select to authenticated using(public.ga_is_admin())',t);end loop;end $$;
create policy settings_update on public.ga_settings for update to authenticated using(public.ga_is_admin()) with check(public.ga_is_admin());
create policy clicks_insert on public.ga_clicks for insert to authenticated with check(public.ga_is_admin());
-- Matches can only be inserted through the validated RPC. Audit records have no client write policy.
grant select on public.ga_admins,public.ga_settings,public.ga_devices,public.ga_clicks,public.ga_calls,public.ga_matches,public.ga_customer_links,public.ga_conversion_drafts,public.ga_audit,public.ga_candidates to authenticated;
grant update(window_seconds) on public.ga_settings to authenticated;
grant insert on public.ga_clicks to authenticated;
commit;
