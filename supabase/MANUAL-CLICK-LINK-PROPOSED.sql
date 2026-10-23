-- Approval required. Attribution database only. CRM is never changed.
begin;
create table public.ga_manual_click_links(
 match_id uuid primary key references public.ga_matches(id),
 interaction_id uuid not null references public.ga_calls(id),
 reason text not null check(length(btrim(reason)) between 10 and 1000),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.ga_manual_click_links enable row level security;
create policy admin_read on public.ga_manual_click_links for select to authenticated using(public.ga_is_admin());
revoke all on public.ga_manual_click_links from public,anon,authenticated;
grant select on public.ga_manual_click_links to authenticated;
create trigger ga_manual_click_link_audit after insert on public.ga_manual_click_links for each row execute function public.ga_audit_change();

create function public.ga_link_click_manually(p_call uuid,p_interaction uuid,p_click uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.ga_calls%rowtype; i public.ga_calls%rowtype; k public.ga_clicks%rowtype; result uuid;
begin
 if not public.ga_is_admin() then raise exception 'Forbidden'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 10 and 1000 then raise exception 'Explain the independent evidence'; end if;
 perform 1 from public.ga_settings where id=1 for share;
 lock table public.ga_calls,public.ga_clicks in share mode;
 lock table public.ga_matches in share row exclusive mode;
 select * into c from public.ga_first_calls where id=p_call;
 if not found then raise exception 'Select the original customer interaction'; end if;
 select * into i from public.ga_calls where id=p_interaction;
 if not found or public.ga_normalized_phone(i.phone) is distinct from public.ga_normalized_phone(c.phone)
  or i.started_at<c.started_at or i.started_at>now() then raise exception 'Interaction belongs to a different customer or invalid date'; end if;
 select * into k from public.ga_clicks where id=p_click;
 if not found or split_part(k.source_key,':',1) is distinct from public.ga_active_click_sheet()
  or k.clicked_at>i.started_at or k.clicked_at>now() or k.clicked_at<now()-interval '90 days'
 then raise exception 'Select an active website click before the chosen interaction'; end if;
 if exists(select 1 from public.ga_matches m join public.ga_clicks used on used.id=m.click_id
  where m.call_id=p_call or public.ga_click_identity(used.id,used.gclid)=public.ga_click_identity(k.id,k.gclid))
 then raise exception 'Customer or website source already linked'; end if;
 lock table public.ga_ads_uploads in share mode;
 if exists(select 1 from public.ga_client_consents consent join public.ga_ads_uploads u on u.consent_id=consent.id where public.ga_normalized_phone(consent.phone)=public.ga_normalized_phone(c.phone))
 then raise exception 'Customer has reserved or submitted conversions'; end if;
 insert into public.ga_matches(call_id,click_id,confirmed_by,confirmation_method)
 values(p_call,p_click,auth.uid(),'manual') returning id into result;
 insert into public.ga_manual_click_links(match_id,interaction_id,reason,created_by)
 values(result,p_interaction,btrim(p_reason),auth.uid());
 return result;
end $$;
revoke all on function public.ga_link_click_manually(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.ga_link_click_manually(uuid,uuid,uuid,text) to authenticated;

create view public.ga_manual_click_reviews with (security_invoker=true) as
 select m.id match_id,m.call_id,m.click_id,i.started_at interaction_at,
 case when not exists(select 1 from public.ga_first_calls f where f.id=c.id) then 'Original customer interaction changed'
 when public.ga_normalized_phone(c.phone) is distinct from public.ga_normalized_phone(i.phone) then 'Manual evidence customer changed'
 when i.started_at<c.started_at then 'Manual evidence interaction changed'
 when i.started_at>now() or k.clicked_at>i.started_at then 'Manual evidence timestamp changed'
 when split_part(k.source_key,':',1) is distinct from public.ga_active_click_sheet() then 'Website source changed'
 when (select count(*) from public.ga_matches other join public.ga_clicks used on used.id=other.click_id
  where public.ga_click_identity(used.id,used.gclid)=public.ga_click_identity(k.id,k.gclid))<>1 then 'Website source has duplicate attribution'
 else '' end reason
 from public.ga_manual_click_links l join public.ga_matches m on m.id=l.match_id
 join public.ga_calls c on c.id=m.call_id join public.ga_calls i on i.id=l.interaction_id
 join public.ga_clicks k on k.id=m.click_id;
revoke all on public.ga_manual_click_reviews from public,anon;
grant select on public.ga_manual_click_reviews to authenticated;
notify pgrst,'reload schema';
commit;
