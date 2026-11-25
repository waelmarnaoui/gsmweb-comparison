-- Approved attribution project only: razskzqcijosftvyuipi.
-- Keep website-paired calls/clicks and manual follow-up evidence indefinitely.
-- Keep consent, Google upload receipts, drafts and action/audit history.
create schema if not exists ga_maintenance;
revoke all on schema ga_maintenance from public,anon,authenticated,service_role;

create or replace function ga_maintenance.cleanup_attribution()
returns jsonb language plpgsql security invoker set search_path='' set lock_timeout='5s' as $$
declare cutoff timestamptz:=now()-interval '7 days'; doomed uuid[]; n bigint; counts jsonb:='{}';
begin
 if not pg_try_advisory_xact_lock(hashtextextended('gsmweb:attribution-retention',0)) then return jsonb_build_object('skipped','already_running');end if;
 -- Freeze matching/imports briefly while finding and deleting unpaired records.
 lock table public.ga_calls,public.ga_clicks,public.ga_matches,public.ga_manual_click_links in share row exclusive mode;
 select coalesce(array_agg(c.id),'{}'::uuid[]) into doomed from public.ga_calls c
 where c.started_at<cutoff
 and not exists(select 1 from public.ga_matches m where m.call_id=c.id)
 and not exists(select 1 from public.ga_manual_click_links l where l.interaction_id=c.id);
 delete from public.ga_conversion_observations where call_id=any(doomed);
 delete from public.ga_customer_links where call_id=any(doomed);
 delete from public.ga_whatsapp_entries where call_id=any(doomed);
 get diagnostics n=row_count;counts:=counts||jsonb_build_object('whatsapp',n);
 delete from public.ga_calls where id=any(doomed);
 get diagnostics n=row_count;counts:=counts||jsonb_build_object('unpaired_calls',n);

 select coalesce(array_agg(c.id),'{}'::uuid[]) into doomed from public.ga_clicks c
 where c.clicked_at<cutoff and not exists(select 1 from public.ga_matches m where m.click_id=c.id);
 delete from public.ga_click_channels where click_id=any(doomed);
 delete from public.ga_clicks where id=any(doomed);
 get diagnostics n=row_count;counts:=counts||jsonb_build_object('unpaired_clicks',n);

 delete from public.ga_stock_monitor_runs where created_at<cutoff;
 get diagnostics n=row_count;counts:=counts||jsonb_build_object('stock_reports',n);
 delete from public.ga_ads_search_runs where created_at<cutoff;
 get diagnostics n=row_count;counts:=counts||jsonb_build_object('search_reports',n);
 delete from public.ga_ads_observations where created_at<cutoff;
 get diagnostics n=row_count;counts:=counts||jsonb_build_object('ads_reports',n);
 delete from public.ga_keyword_reports where created_at<cutoff;
 get diagnostics n=row_count;counts:=counts||jsonb_build_object('keyword_reports',n);
 insert into public.ga_audit(actor,action,entity,record_id,details)
 values(null,'RETENTION_CLEANUP','attribution_retention',null,jsonb_build_object('cutoff',cutoff,'deleted',counts,'website_pairs_preserved',true));
 return jsonb_build_object('cutoff',cutoff,'deleted',counts);
end $$;
revoke all on function ga_maintenance.cleanup_attribution() from public,anon,authenticated,service_role;

-- Old Android backfills must not fill the database again after cleanup.
-- Existing retained matches are untouched; INSERT skips expired historical rows.
create or replace function ga_maintenance.skip_expired_import()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.started_at<now()-interval '7 days' then
  if new.external_id like 'whatsapp-manual:%' then raise exception 'First message is older than the seven-day retention window';end if;
  return null;
 end if;
 return new;
end $$;
revoke all on function ga_maintenance.skip_expired_import() from public,anon,authenticated,service_role;
drop trigger if exists ga_calls_retention_guard on public.ga_calls;
create trigger ga_calls_retention_guard before insert on public.ga_calls
for each row execute function ga_maintenance.skip_expired_import();

-- Production scheduling (UTC); the cleanup is independent of Vercel/laptop uptime.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('gsmweb-retention-daily','15 2 * * *',$job$
 select ga_maintenance.cleanup_attribution();
 delete from cron.job_run_details where end_time<now()-interval '7 days'
 and jobid in(select jobid from cron.job where jobname in ('gsmweb-retention-daily','gsmweb-retention-vacuum'));
$job$);
select cron.schedule('gsmweb-retention-vacuum','30 2 * * *',
 'VACUUM (ANALYZE) public.ga_stock_monitor_runs, public.ga_calls, public.ga_clicks, public.ga_ads_search_runs, public.ga_ads_observations, public.ga_keyword_reports;');
