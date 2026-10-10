-- Review and apply only to the attribution/call database, never the CRM project.
-- Existing numbers, authentication and RLS remain unchanged.
begin;
alter table public.ga_calls drop constraint if exists ga_calls_phone_check;
alter table public.ga_calls add constraint ga_calls_phone_check
 check (phone ~ '^\+[1-9][0-9]{7,14}$');
commit;

