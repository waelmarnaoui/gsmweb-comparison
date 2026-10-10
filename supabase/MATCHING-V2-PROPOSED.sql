-- REVIEW/APPROVAL REQUIRED. Attribution database only; no CRM changes or data deletion.
-- Supersedes AUTO-MATCH, MISSED-CALL-MATCHING and FIRST-INTERACTION matching rules.
begin;
alter table public.ga_matches add column if not exists confirmation_method text
 not null default 'manual' check (confirmation_method in ('manual','automatic'));

create or replace function public.ga_normalized_phone(p_phone text)
returns text language sql immutable strict set search_path='' as $$
 with cleaned as (select regexp_replace(p_phone,'[[:space:]().-]','','g') as n),
 normalized as (select case when n like '00%' then '+'||substr(n,3)
  when n ~ '^0[0-9]{9}$' then '+40'||substr(n,2)
  when n ~ '^40[0-9]{9}$' then '+'||n else n end as n from cleaned)
 select case when n ~ '^\+[1-9][0-9]{7,14}$' then n end from normalized
$$;
create or replace function public.ga_click_identity(p_id uuid,p_gclid text)
returns text language sql immutable set search_path='' as $$
 select case when nullif(btrim(p_gclid),'') is not null then 'gclid:'||btrim(p_gclid)
 else 'click:'||p_id::text end
$$;
revoke all on function public.ga_normalized_phone(text),public.ga_click_identity(uuid,text) from public,anon;
grant execute on function public.ga_normalized_phone(text),public.ga_click_identity(uuid,text) to authenticated;

-- The invoker views must not expose encrypted connection records to browser clients.
create or replace function public.ga_active_click_sheet()
returns text language plpgsql stable security definer set search_path='' as $$
declare selected_sheet text; has_connection boolean;
begin
 if not public.ga_is_admin() then raise exception 'Forbidden'; end if;
 if to_regclass('public.ga_connections') is not null then
  execute 'select exists(select 1 from public.ga_connections where id=''google'')' into has_connection;
  if has_connection then
   execute 'select metadata->>''sheet_id'' from public.ga_connections where id=''google''' into selected_sheet;
   return selected_sheet;
  end if;
 end if;
 -- Service-account imports do not have an OAuth connection record.
 select details->>'sheet_id' into selected_sheet from public.ga_audit
 where entity='ga_sheet_import' order by created_at desc,id desc limit 1;
 return selected_sheet;
end $$;
revoke all on function public.ga_active_click_sheet() from public,anon;
grant execute on function public.ga_active_click_sheet() to authenticated;

create or replace view public.ga_first_calls with (security_invoker=true) as
 select distinct on (public.ga_normalized_phone(c.phone)) c.*
 from public.ga_calls c
 where c.direction in ('incoming','missed')
 and public.ga_normalized_phone(c.phone) is not null
 and c.started_at>='2026-09-23T21:00:00Z'::timestamptz and c.started_at<=now()
 order by public.ga_normalized_phone(c.phone),c.started_at,c.id;

-- Compute the complete graph BEFORE excluding existing matches or applying date filters.
-- A competing call remains a conflict even if it is already matched to another source.
create or replace view public.ga_match_options with (security_invoker=true) as
 with pairs as (
  select c.id call_id,k.id click_id,c.started_at,k.clicked_at,
   public.ga_click_identity(k.id,k.gclid) source_identity,
   greatest(c.started_at+make_interval(secs=>s.window_seconds),
    c.created_at+interval '120 seconds',k.created_at+interval '120 seconds') settled_at
  from public.ga_first_calls c cross join public.ga_settings s
  join public.ga_clicks k on k.clicked_at<=c.started_at
   and c.started_at-k.clicked_at<=make_interval(secs=>s.window_seconds)
   and split_part(k.source_key,':',1)=public.ga_active_click_sheet()
 ), grouped as (
  select distinct on (call_id,source_identity) call_id,click_id,source_identity,started_at,clicked_at,
   count(*) over(partition by call_id,source_identity) related_clicks,
   max(settled_at) over(partition by call_id,source_identity) settled_at
  from pairs order by call_id,source_identity,clicked_at desc,click_id
 ), counted as (
  select g.*,count(*) over(partition by call_id) candidate_count,
   count(*) over(partition by source_identity) competing_calls from grouped g
 )
 select g.call_id,g.click_id,extract(epoch from g.started_at-g.clicked_at)::integer delay_seconds,
  g.candidate_count,g.competing_calls,g.related_clicks,g.source_identity,g.settled_at,
  exists(select 1 from public.ga_matches m where m.call_id=g.call_id) call_matched,
  exists(select 1 from public.ga_matches m join public.ga_clicks k on k.id=m.click_id
   where public.ga_click_identity(k.id,k.gclid)=g.source_identity) source_claimed
 from counted g;

create or replace view public.ga_candidates with (security_invoker=true) as
 select call_id,click_id,delay_seconds,candidate_count from public.ga_match_options
 where not call_matched and not source_claimed;

-- Existing records are never rewritten. Newly discovered conflicts block export.
create or replace view public.ga_match_reviews with (security_invoker=true) as
 select m.id match_id,m.call_id,m.click_id,
 case
  when f.id is null then 'Not the first incoming or missed call'
  when k.clicked_at>c.started_at or c.started_at-k.clicked_at>make_interval(secs=>s.window_seconds)
   then 'Selected click is outside the current matching window'
  when o.call_id is null then 'No current website candidate'
  when o.candidate_count<>1 then 'More than one website source fits this call'
  when o.competing_calls<>1 then 'Website source fits more than one caller'
  when (select count(*) from public.ga_matches other join public.ga_clicks used on used.id=other.click_id
   where public.ga_click_identity(used.id,used.gclid)=public.ga_click_identity(k.id,k.gclid))<>1
   then 'Website source has duplicate attribution'
  when o.settled_at>now() then 'Waiting for recently imported call and click records'
  else '' end reason
 from public.ga_matches m join public.ga_calls c on c.id=m.call_id
 join public.ga_clicks k on k.id=m.click_id cross join public.ga_settings s
 left join public.ga_first_calls f on f.id=c.id
 left join public.ga_match_options o on o.call_id=m.call_id
  and o.source_identity=public.ga_click_identity(k.id,k.gclid);

create or replace view public.ga_sheet_sync_state with (security_invoker=true) as
 select distinct on (details->>'sheet_id') details->>'sheet_id' sheet_id,created_at synced_at,action
 from public.ga_audit where entity='ga_sheet_import' and action in ('SYNC_SUCCESS','SYNC_FAILED')
 and details->>'sheet_id' is not null order by details->>'sheet_id',created_at desc,id desc;

create or replace function public.ga_record_click_sync(p_sheet text,p_received integer,p_inserted integer,p_success boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.ga_is_admin() then raise exception 'Forbidden'; end if;
 if p_sheet is null or length(p_sheet)>256 or length(p_sheet)<1
  or p_received is null or p_inserted is null or p_success is null
  or p_received not between 0 and 10000 or p_inserted not between 0 and p_received
 then raise exception 'Invalid import status'; end if;
 insert into public.ga_audit(actor,action,entity,record_id,details)
 values(auth.uid(),case when p_success then 'SYNC_SUCCESS' else 'SYNC_FAILED' end,
  'ga_sheet_import',p_sheet,jsonb_build_object('sheet_id',p_sheet,'received',p_received,'inserted',p_inserted));
end $$;

create or replace function public.ga_matching_health()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.ga_is_admin() then raise exception 'Forbidden'; end if;
 return jsonb_build_object('version',case when
  position('public.ga_match_options' in pg_get_functiondef('public.ga_auto_confirm_matches(timestamptz)'::regprocedure))>0
  and position('public.ga_match_options' in pg_get_functiondef('public.ga_confirm_match(uuid,uuid)'::regprocedure))>0
  and position('ga_match_options' in pg_get_viewdef('public.ga_candidates'::regclass))>0
  and to_regprocedure('public.ga_record_click_sync(text,integer,integer,boolean)') is not null
  then 2 else 0 end,'first_interaction',true,'grouped_gclid',true,
  'global_competition',true,'settle_seconds',120,'cutoff','2026-09-23T21:00:00Z');
end $$;

create or replace function public.ga_auto_confirm_matches(p_since timestamptz)
returns integer language plpgsql security definer set search_path='' as $$
declare candidate record; matched integer:=0;
begin
 if not public.ga_is_admin() then raise exception 'Forbidden'; end if;
 if p_since is null then raise exception 'Start date required'; end if;
 if not exists(select 1 from public.ga_sheet_sync_state
  where sheet_id=public.ga_active_click_sheet() and action='SYNC_SUCCESS'
  and synced_at between now()-interval '30 minutes' and now())
 then raise exception 'Fresh complete website import required'; end if;
 perform 1 from public.ga_settings where id=1 for share;
 -- Prevent ingestion or another match transaction changing the graph during this decision.
 lock table public.ga_calls,public.ga_clicks in share mode;
 lock table public.ga_matches in share row exclusive mode;
 for candidate in
  select o.call_id,o.click_id from public.ga_match_options o
  join public.ga_calls c on c.id=o.call_id
  where c.started_at>=greatest(p_since,'2026-09-23T21:00:00Z'::timestamptz)
  and not o.call_matched and not o.source_claimed
  and o.candidate_count=1 and o.competing_calls=1 and o.settled_at<=now()
  order by c.started_at,o.call_id limit 500
 loop
  insert into public.ga_matches(call_id,click_id,confirmed_by,confirmation_method)
  values(candidate.call_id,candidate.click_id,auth.uid(),'automatic');
  matched:=matched+1;
 end loop;
 return matched;
end $$;

create or replace function public.ga_confirm_match(p_call uuid,p_click uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; chosen record;
begin
 if not public.ga_is_admin() then raise exception 'Forbidden'; end if;
 if not exists(select 1 from public.ga_sheet_sync_state
  where sheet_id=public.ga_active_click_sheet() and action='SYNC_SUCCESS'
  and synced_at between now()-interval '30 minutes' and now())
 then raise exception 'Fresh complete website import required'; end if;
 perform 1 from public.ga_settings where id=1 for share;
 lock table public.ga_calls,public.ga_clicks in share mode;
 lock table public.ga_matches in share row exclusive mode;
 select * into chosen from public.ga_match_options where call_id=p_call and click_id=p_click;
 if not found then raise exception 'Not a current first-interaction candidate'; end if;
 if chosen.call_matched or chosen.source_claimed then raise exception 'Call or website source already attributed'; end if;
 if chosen.candidate_count<>1 or chosen.competing_calls<>1 then raise exception 'Ambiguous attribution requires independent evidence'; end if;
 if chosen.settled_at>now() then raise exception 'Waiting for recently imported records'; end if;
 insert into public.ga_matches(call_id,click_id,confirmed_by,confirmation_method)
 values(p_call,p_click,auth.uid(),'manual') returning id into result;
 return result;
end $$;

revoke all on function public.ga_matching_health(),public.ga_confirm_match(uuid,uuid),public.ga_auto_confirm_matches(timestamptz) from public,anon;
grant execute on function public.ga_matching_health(),public.ga_confirm_match(uuid,uuid),public.ga_auto_confirm_matches(timestamptz) to authenticated;
revoke all on public.ga_first_calls,public.ga_match_options,public.ga_match_reviews from public,anon;
grant select on public.ga_first_calls,public.ga_match_options,public.ga_match_reviews to authenticated;
revoke all on function public.ga_record_click_sync(text,integer,integer,boolean) from public,anon;
grant execute on function public.ga_record_click_sync(text,integer,integer,boolean) to authenticated;
revoke all on public.ga_sheet_sync_state from public,anon;
grant select on public.ga_sheet_sync_state to authenticated;
notify pgrst,'reload schema';
commit;
