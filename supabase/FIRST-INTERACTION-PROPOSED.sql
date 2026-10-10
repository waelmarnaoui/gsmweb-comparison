-- Review and approve for the attribution database only. No CRM data changes.
begin;
create or replace view public.ga_candidates with (security_invoker=true) as
 select c.id call_id,k.id click_id,
 extract(epoch from c.started_at-k.clicked_at)::integer delay_seconds,
 count(*) over(partition by c.id) candidate_count
 from public.ga_calls c join public.ga_clicks k on k.clicked_at<=c.started_at
 cross join public.ga_settings s
 where c.direction in ('incoming','missed')
 and c.started_at>='2026-09-23T21:00:00Z'::timestamptz
 and not exists(select 1 from public.ga_calls earlier
  where earlier.phone=c.phone and earlier.direction in ('incoming','missed')
  and earlier.started_at>='2026-09-23T21:00:00Z'::timestamptz
  and (earlier.started_at,earlier.id)<(c.started_at,c.id))
 and c.started_at-k.clicked_at<=make_interval(secs=>s.window_seconds)
 and not exists(select 1 from public.ga_matches m where m.call_id=c.id or m.click_id=k.id);

create or replace function public.ga_confirm_match(p_call uuid,p_click uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if not ga_is_admin() then raise exception 'Forbidden'; end if;
 if not exists(select 1 from ga_calls c cross join ga_clicks k cross join ga_settings s
  where c.id=p_call and k.id=p_click and c.direction in ('incoming','missed')
  and c.started_at>='2026-09-23T21:00:00Z'::timestamptz
 and not exists(select 1 from public.ga_calls earlier
  where earlier.phone=c.phone and earlier.direction in ('incoming','missed')
  and earlier.started_at>='2026-09-23T21:00:00Z'::timestamptz
  and (earlier.started_at,earlier.id)<(c.started_at,c.id))
  and k.clicked_at<=c.started_at and c.started_at-k.clicked_at<=make_interval(secs=>s.window_seconds))
 then raise exception 'Outside matching window'; end if;
 insert into ga_matches(call_id,click_id,confirmed_by) values(p_call,p_click,auth.uid()) returning id into result;
 return result;
end $$;
revoke all on function public.ga_confirm_match(uuid,uuid) from public,anon;
grant execute on function public.ga_confirm_match(uuid,uuid) to authenticated;

create or replace function public.ga_auto_confirm_matches(p_since timestamptz)
returns integer language plpgsql security definer set search_path=public as $$
declare candidate record; matched integer:=0;
begin
 if not public.ga_is_admin() then raise exception 'Forbidden'; end if;
 perform 1 from public.ga_settings where id=1 for share;
 lock table public.ga_matches in share row exclusive mode;
 for candidate in
  select call_id,click_id from (
   select k.call_id,k.click_id,k.candidate_count,
    count(*) over(partition by k.click_id) as eligible_calls
   from public.ga_candidates k join public.ga_calls c on c.id=k.call_id
   where c.started_at>=greatest(p_since,'2026-09-23T21:00:00Z'::timestamptz)
  ) eligible where candidate_count=1 and eligible_calls=1
  order by call_id limit 500
 loop
  begin
   insert into public.ga_matches(call_id,click_id,confirmed_by,confirmation_method)
   values(candidate.call_id,candidate.click_id,auth.uid(),'automatic');
   matched:=matched+1;
  exception when unique_violation then null;
  end;
 end loop;
 return matched;
end $$;
revoke all on function public.ga_auto_confirm_matches(timestamptz) from public,anon;
grant execute on function public.ga_auto_confirm_matches(timestamptz) to authenticated;
commit;
