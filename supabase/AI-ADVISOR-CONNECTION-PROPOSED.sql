-- Preserve existing encrypted connections; permit one server-only advisor entry.
begin;
alter table public.ga_connections drop constraint if exists ga_connections_id_check;
alter table public.ga_connections add constraint ga_connections_id_check check(id in('google','google_ads','google_ads_management','supabase_calls','supabase_crm','ai_advisor'));
commit;
