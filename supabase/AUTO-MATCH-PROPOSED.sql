-- Review/approval required. App-owned attribution tables only; no CRM changes.
begin;
alter table public.ga_matches add column if not exists confirmation_method text
 not null default 'manual' check (confirmation_method in ('manual','automatic'));
create or replace function public.ga_auto_confirm_matches(p_since timestamptz)
returns integer language plpgsql security definer set search_path=public as $$
declare candidate record; matched integer:=0;
begin
 if not public.ga_is_admin() then raise exception 'Forbidden'; end if;
 -- Serialize attribution decisions; uniqueness constraints remain the final guard.
 perform 1 from public.ga_settings where id=1 for share;
 lock table public.ga_matches in share row exclusive mode;
 for candidate in
  select call_id,click_id from (
   select k.call_id,k.click_id,k.candidate_count,
    count(*) over(partition by k.click_id) as eligible_calls
   from public.ga_candidates k join public.ga_calls c on c.id=k.call_id
   where c.started_at>=greatest(p_since,'2026-10-08T21:00:00Z'::timestamptz)
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
