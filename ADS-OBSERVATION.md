# Google Ads observation increment

This increment adds read-only campaign collection and `/optimizer` in gsmweb-comparison. Target CPC is 3 RON; it is not CPA. No Ads mutations, bid execution, autonomous approvals, currency conversions or claimed profit calculations are implemented. The earlier production design remains the roadmap, not a description of completed features.

## Setup after review

1. Review `supabase/ADS-OBSERVATION-PROPOSED.sql` and apply in the attribution database after the existing connections migration. It adds an independently encrypted management connection and append-only report storage. Do not apply in the CRM database. No migration was applied by this change.
2. Configure Google Ads API enablement and appropriate project access. Set `GOOGLE_ADS_MANAGEMENT_OAUTH_CLIENT_ID` and `GOOGLE_ADS_MANAGEMENT_OAUTH_CLIENT_SECRET` on the server. They may belong to the existing OAuth registration, but the connection and consent grant remain separate. Register `APP_URL/api/integrations/google_ads_management/callback`. Scope: `https://www.googleapis.com/auth/adwords`. This Google scope permits management; this implementation only calls reporting endpoints. Prefer a Google Ads user with read-only account permissions during observation.
3. Set `GOOGLE_ADS_CUSTOMER_ID` to the verified ten-digit client account, and `GOOGLE_ADS_LOGIN_CUSTOMER_ID` only if accessing through a manager. Do not assume the conversion uploader's hardcoded account is the intended reporting destination. Retain existing encryption, Supabase and Data Manager settings.
4. Deploy to staging, sign in as an existing app administrator, open `/optimizer`, connect reporting and collect a report. Confirm account, currency, timezone, reporting dates and totals against Ads. A non-RON account shows a currency mismatch and does not compare its CPC to 3 RON.
5. For unattended monitoring, configure a managed scheduler to call `GET /api/optimizer/cron` every 30 minutes with `Authorization: Bearer <ADS_MONITOR_CRON_SECRET>`. Use a random server secret of at least 32 characters. No schedule is activated by this source change. Confirm your host's execution timeout supports paginated reports; truncated reports are discarded. Monitor non-200 responses externally, alert on missed runs, and perform a restart/retry drill. Never put the secret in a query string.

## Data and security behavior

- Seven completed account-calendar days of Search campaigns, with native aggregate impression-share estimates; excluded today does not imply all prior data is mature.
- Cost remains in account currency; clicks with no reported activity are not confused with free clicks. Censored or missing shares display unavailable.
- Reports require verified account identity and complete pagination, and reject duplicate campaigns and invalid metric ranges. Google provider error bodies are not returned to the browser.
- Admin-only report and manual collection routes; origin checks for manual collection; independently authenticated scheduler. Browser database roles cannot read or write snapshots. The service role has insert/select, not update/delete, on this new table.
- Half-hour unique slots deduplicate retries without overwriting history. Same-slot manual refresh can read a newer report but retains the first stored snapshot; the UI always reloads the saved snapshot. Errors do not replace the most recent successful snapshot. Reports older than one hour are labeled stale.
- Snapshots include request IDs and capture timestamps. They are collection history, not a complete optimization audit ledger. Database owners remain privileged. Retention/archival and independent audit export must be defined before sustained production operation.
- CPC is calculated from total cost / total clicks, not by averaging daily CPCs. No FX rate is inferred from the reported USD baseline.

## Remaining production gates

Verify deployed OAuth and source access; reconcile campaign attribution, customer identity, installments/refunds and CRM contribution profit; agree spend/visibility/volume limits and mature cohort windows; implement a versioned proposal and exact-payload human approval ledger; build and failure-test a separate executor and compensating rollback flow. Add monitoring alerts, historical replay, deployment health checks, retention and production ownership. This first increment cannot change ads even if a CPC target is missed.

## Verification

Run `pnpm test`, `pnpm typecheck`, and `pnpm build`. Collector fixtures cover pagination, identity mismatch, malformed metrics, missing/censored shares, provider redaction, DST dates and RON/USD comparison. SQL tests run in local embedded PostgreSQL and cover migration repeatability, append-only service permissions, browser-role denial and duplicate slots. These tests do not contact Google Ads or a production database.

Official references: [REST authorization](https://developers.google.com/google-ads/api/rest/auth), [search pagination](https://developers.google.com/google-ads/api/rest/common/search), [API access migration](https://developers.google.com/google-ads/api/docs/api-policy/developer-token), [share metrics](https://developers.google.com/google-ads/api/fields/v26/metrics). Pin and revalidate the API version during upgrades; current collection is v26.
