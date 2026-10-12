-- Approval required. Attribution project razskzqcijosftvyuipi only. CRM untouched.
-- Unified interaction storage retains the legacy ga_calls table name.
begin;
create table if not exists public.ga_whatsapp_entries(
 call_id uuid primary key references public.ga_calls(id),
 phone text unique not null,
 time_precision text not null check(time_precision in ('minute','second')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp()
);
create table if not exists public.ga_click_channels(
 click_id uuid primary key references public.ga_clicks(id),
 channel text not null check(channel in ('call','whatsapp'))
);
alter table public.ga_whatsapp_entries enable row level security;
alter table public.ga_click_channels enable row level security;
drop policy if exists admin_read on public.ga_whatsapp_entries;
create policy admin_read on public.ga_whatsapp_entries for select to authenticated using(public.ga_is_admin());
drop policy if exists admin_read on public.ga_click_channels;
create policy admin_read on public.ga_click_channels for select to authenticated using(public.ga_is_admin());
revoke all on public.ga_whatsapp_entries,public.ga_click_channels from public,anon,authenticated;
grant select on public.ga_whatsapp_entries,public.ga_click_channels to authenticated;
drop trigger if exists ga_whatsapp_audit on public.ga_whatsapp_entries;
create trigger ga_whatsapp_audit after insert on public.ga_whatsapp_entries for each row execute function public.ga_audit_change();
drop trigger if exists ga_click_channel_audit on public.ga_click_channels;
create trigger ga_click_channel_audit after insert or update on public.ga_click_channels for each row execute function public.ga_audit_change();

create or replace function public.ga_record_manual_whatsapp(p_phone text,p_started timestamptz,p_precision text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare normalized text;entry public.ga_whatsapp_entries%rowtype;interaction uuid;
 device constant uuid:='77777777-7777-4777-8777-777777777701';
begin
 if not public.ga_is_admin() then raise exception 'Forbidden';end if;
 normalized:=public.ga_normalized_phone(p_phone);
 if normalized is null or p_started is null or p_started<'2026-09-23T21:00:00Z'::timestamptz or p_started>clock_timestamp()
  or p_precision is null or p_precision not in ('minute','second')
  or (p_precision='minute' and p_started<>date_trunc('minute',p_started)) then raise exception 'Invalid first-message entry';end if;
 perform pg_advisory_xact_lock(hashtextextended('manual-whatsapp:'||normalized,0));
 select * into entry from public.ga_whatsapp_entries where phone=normalized;
 if found then return jsonb_build_object('saved',false,'callId',entry.call_id);end if;
 insert into public.ga_devices(id,name,token_hash,active)
 values(device,'Internal manual WhatsApp',gen_random_uuid()::text,false) on conflict(id) do nothing;
 if not exists(select 1 from public.ga_devices where id=device and name='Internal manual WhatsApp' and not active) then raise exception 'Internal source unavailable';end if;
 insert into public.ga_calls(device_id,external_id,phone,started_at,duration_seconds,direction)
 values(device,'whatsapp-manual:'||normalized,normalized,p_started,0,'incoming') returning id into interaction;
 insert into public.ga_whatsapp_entries(call_id,phone,time_precision,created_by)
 values(interaction,normalized,p_precision,auth.uid());
 return jsonb_build_object('saved',true,'callId',interaction);
end $$;
create or replace function public.ga_record_click_channels(p_items jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;
begin
 if not public.ga_is_admin() then raise exception 'Forbidden';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Invalid click channels';end if;
 if jsonb_array_length(p_items)>200 then raise exception 'Invalid click channels';end if;
 -- Same locks/order as the existing matching functions protect the complete graph.
 lock table public.ga_calls,public.ga_clicks in share mode;
 lock table public.ga_matches in share row exclusive mode;
 for item in select value from jsonb_array_elements(p_items) loop
  insert into public.ga_click_channels(click_id,channel) values((item->>'click_id')::uuid,item->>'channel')
  on conflict(click_id) do update set channel=excluded.channel where ga_click_channels.channel<>excluded.channel;
 end loop;
end $$;
revoke all on function public.ga_record_manual_whatsapp(text,timestamptz,text),public.ga_record_click_channels(jsonb) from public,anon;
grant execute on function public.ga_record_manual_whatsapp(text,timestamptz,text),public.ga_record_click_channels(jsonb) to authenticated;

-- Preserve global competition/GCLID ownership; only add channel and time-precision checks.
create or replace view public.ga_match_options with (security_invoker=true) as
 with pairs as (
  select c.id call_id,k.id click_id,c.started_at,k.clicked_at,
   public.ga_click_identity(k.id,k.gclid) source_identity,
   case when k.clicked_at>c.started_at or c.started_at+make_interval(secs=>case when w.time_precision='minute' then 59 else 0 end)-k.clicked_at>make_interval(secs=>s.window_seconds)
    then 'infinity'::timestamptz
    else greatest(c.started_at+make_interval(secs=>s.window_seconds+case when w.time_precision='minute' then 59 else 0 end),c.created_at+interval '120 seconds',k.created_at+interval '120 seconds') end settled_at
  from public.ga_first_calls c cross join public.ga_settings s
  left join public.ga_whatsapp_entries w on w.call_id=c.id
  join public.ga_clicks k on k.clicked_at<=c.started_at+make_interval(secs=>case when w.time_precision='minute' then 59 else 0 end)
   and c.started_at-k.clicked_at<=make_interval(secs=>s.window_seconds)
   and split_part(k.source_key,':',1)=public.ga_active_click_sheet()
  left join public.ga_click_channels channel on channel.click_id=k.id
  where case when w.call_id is not null then channel.channel='whatsapp' else coalesce(channel.channel,'call')='call' end
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
notify pgrst,'reload schema';
commit;
