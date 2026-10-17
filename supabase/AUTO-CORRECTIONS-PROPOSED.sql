-- Additive, agent-created ads only. No original ads or inventory data changes.
begin;
alter table public.ga_ads_control add column auto_correction_enabled boolean not null default false,add column auto_correction_authorization text;
alter table public.ga_ads_control add constraint ga_ads_correction_authorized check(not auto_correction_enabled or auto_correction_authorization is not null);
create unique index ga_ads_one_editorial_correction on public.ga_ads_publications ((plan->'correction'->>'parentId')) where plan ? 'correction';
alter table public.ga_ads_publications add constraint ga_ads_correction_identity check(not(plan ? 'correction') or coalesce((jsonb_typeof(plan->'correction')='object' and plan->'correction'->>'parentId' ~ '^[a-f0-9]{64}$' and plan->'correction'->>'parentId'<>id and plan->'correction'->>'attempt'='1'),false));
create function public.ga_ads_correction_settings_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.ga_ads_action_events(account_id,event,details) values(new.account_id,'automatic_correction_settings',jsonb_build_object('enabled',new.auto_correction_enabled,'authorization',new.auto_correction_authorization,'scope','agent_created_disapproved_editorial_only'));return new;
end $$;
create trigger ga_ads_correction_settings_audit after update of auto_correction_enabled,auto_correction_authorization on public.ga_ads_control for each row execute function public.ga_ads_correction_settings_audit();
revoke all on function public.ga_ads_correction_settings_audit() from public,anon,authenticated;
grant execute on function public.ga_ads_correction_settings_audit() to service_role;
commit;
