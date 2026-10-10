# Matching system v2

This replaces the older incoming-only and raw-click-count matching rules. Apply only `supabase/MATCHING-V2-PROPOSED.sql` to the original call-attribution project after approval. Do not apply older matching migrations afterward. No CRM schema or rows are changed, and no original calls, clicks, matches or drafts are deleted or reassigned.

## Source completeness

The protected automatic matching POST refreshes the selected Google spreadsheet before deciding matches. Visible dashboard polling checks every 30 seconds; successful source reads are reused for at most 60 seconds. The explicit import button forces a read. Repeated imports are idempotent, including sheets that reuse an event ID for different timestamps. Blank or invalid dates fail the import rather than inventing a timestamp. A partial import records failure and is retried without discarding successfully stored events.

Import outcomes are audited without credentials. Both matching RPCs require a successful complete import for the currently selected sheet within the last 30 minutes. Conversion exports also require fresh import status. Switching spreadsheets excludes previous-sheet candidates, but never frees previously attributed GCLIDs for another client.

This is dashboard-driven synchronization, not an unattended scheduler. Closing all dashboards stops source polling. A separate server scheduler is still required to guarantee half-hour source refreshes with the app closed; this change does not claim Vercel Hobby can run half-hour cron jobs. Android upload timing is a separate WorkManager concern.

## Call and click matching

- Normalize Romanian local formats and explicit international country codes consistently in TypeScript and PostgreSQL. Invalid/private numbers cannot receive attribution. Do not infer a foreign country code from an unprefixed local number.
- Keep only the earliest incoming or missed call for each normalized phone since 24 September 2026, independent of dashboard date filters. Timestamp ties use the smallest UUID. Outgoing-only numbers remain visible but ineligible. Follow-ups remain stored.
- Preserve the exact instant and sub-second call precision. Offset-free sheet dates mean Europe/Bucharest. Reject DST ambiguity and invalid calendar dates instead of shifting them silently.
- Match only clicks before the first call, within the administrator's configured inclusive window (default 120 seconds). A click 120.001 seconds earlier cannot qualify. Never widen the window for one customer.
- Group repeated click rows with the same nonempty, case-sensitive GCLID as one source. Choose its most recent eligible click as the representative. Blank GCLIDs remain distinct events; temporal proximity alone does not justify merging them.
- Compute all candidate sources and all competing first callers before applying filters or excluding existing matches. Automatic and manual confirmation require exactly one source for the call and exactly one first caller for that source. Never resolve an ambiguous graph by greedily choosing the nearest click or eliminating another caller because they were matched elsewhere.
- Reserve the complete GCLID, not just one spreadsheet row. Legacy duplicates remain stored but are flagged, not exported.
- Wait for the configured call window to close and at least two minutes after new call/click ingestion before confirmation. This reduces import-order races but cannot guarantee a provider never sends late data.
- Serialize decisions while holding call/click read locks and match-write locks. Retain unique call and click constraints and the existing audit trigger.

## Saved matches and payments

Re-evaluate saved matches against current first calls, sources, competition and window settings. Later imports can flag a previous attribution as unsafe. Keep its record and payment reservation; never silently move it to another customer. Unsafe matches are shown as ambiguous with a reason and held from conversion preparation/export.

CRM linking still requires exactly one normalized phone match. Missing CRM clients are not an attribution failure: a website/call match can exist before the client arrives. Never fabricate a CRM client or export an expected payment. Conversion readiness still requires a real active payment, a visit after the first call within 14 days, the approved end-of-day Romanian payment timestamp, and a unique stable payment order ID. Phone-only conversions remain separately identified and do not claim locally proven Google Ads attribution. No automatic Google Ads upload is introduced.

## Diagnostics

The call review shows the decision reason, grouped repeat-click count and retained follow-up count. Administrators can open `/api/attribution/diagnose?phone=INTERNATIONAL_NUMBER` (URL-encode the plus sign) for a read-only explanation: first call, follow-ups, installed rule version, selected sheet, import status, nearby imported clicks, exact delays and conflicts. Missing migrations are explicitly pending; the app never falls back to the old unsafe automatic function.

For the reported timeline, 10 October 2026 09:41:10 precedes the missed call at 09:42:16 by 66 seconds. The 09:40:07 click is 129 seconds earlier and outside 120 seconds. A callback at 11:04:28 cannot replace the missed call. This timeline qualifies only after the sheet events are actually imported and no other first caller/source competes.

Timestamp-only website events do not contain verified caller identity. A unique temporal candidate is an inference, not a guarantee. For stronger identity attribution, add a shared visitor/call tracking identifier or dynamic number insertion; do not promise zero false or missed matches from timestamps alone.

## Security and verification

All new views use security-invoker behavior and existing RLS. Restricted functions validate administrator identity, have an empty search path and schema-qualified application references. The active-sheet helper exposes only the selected sheet ID, never encrypted credentials. Privileged keys stay on the server. Missing/failed reads stop decisions rather than returning partial graphs.

Tests use isolated local PostgreSQL instances, not production customers. Coverage includes the missed-call timeline, repeated GCLIDs, foreign numbers, exact boundaries, many-to-one/one-to-many ambiguity, global date-filter competition, preserved historical claims, late-arrival invalidation, settling delays, selected-sheet changes, stale/failed imports, idempotency, audit records and anonymous/non-admin denial. Run the full unit/database suite, TypeScript and production build before deployment.
