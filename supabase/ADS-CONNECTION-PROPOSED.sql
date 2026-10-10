-- Approval required. Run only in the attribution database, never the CRM.
-- Allows a separately encrypted Google Ads OAuth connection.
begin;
alter table public.ga_connections drop constraint if exists ga_connections_id_check;
alter table public.ga_connections add constraint ga_connections_id_check
 check(id in ('google','google_ads','supabase_calls','supabase_crm'));
commit;

