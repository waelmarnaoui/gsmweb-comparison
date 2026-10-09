# Activate the live Vercel workspace

No SQL migration or existing CRM table change is included in this update.

## Vercel environment variables

In gsmweb-comparison > Settings > Environment Variables, configure Production and Preview as appropriate, then redeploy:

| Name | Value |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | https://razskzqcijosftvyuipi.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Your Supabase publishable key |
| GOOGLE_SHEET_ID | 14wmk6KJ7p4d-p9KctSGj4MtKVk4w0XvH1qfvKox0Sgw |
| GOOGLE_SERVICE_ACCOUNT_JSON | Google service account JSON, server-only |
| GOOGLE_SHEET_RANGE | Optional range including headers; leave unset for first tab |
| GOOGLE_ADS_CONVERSION_NAME | Exact existing Google Ads conversion action name, only needed for export |

The web dashboard uses the signed-in administrator's Supabase session and RLS. It does not need a privileged Supabase key to read calls, import clicks, or confirm attribution. Never put a secret/service-role key in a NEXT_PUBLIC_ variable. Rotate credentials previously shared in chat before production use.

## Private Google Sheet access

Enable Google Sheets API in your Google Cloud project. Create a dedicated service account and JSON key. Share this Sheet with that account's client_email as Viewer. Add the JSON only to Vercel's GOOGLE_SERVICE_ACCOUNT_JSON environment variable, never to GitHub. An organization may prohibit service account keys; use an approved managed credential provider in that case.

The importer expects a header row with timestamp (or clicked_at), and optional event_id, gclid, campaign, page_url, session_id. Timestamps must be ISO dates with an explicit timezone, for example 2026-10-10T12:00:00+03:00. Do not guess timestamps from local date strings. Check the real Sheet headers before importing. Stable event_id values are recommended; otherwise a hash of normalized event values prevents repeated identical imports.

## Workflow

Sign in using the approved Supabase Auth administrator account, not your Supabase dashboard GitHub login. Open Settings > Check connections > Import website clicks. The app reads saved ga_calls and calculates candidates through ga_candidates using ga_settings.window_seconds. Default is 120 seconds. Confirmation uses the existing ga_confirm RPC and database uniqueness constraints.

The dashboard shows the latest 500 calls starting 9 October 2026, midnight Bucharest time. Older calls are retained in the database but hidden. Android status reports saved records, not a guarantee of current collector uptime. Google Sheets imports are manual in this update. The Android collector's existing upload schedule is unchanged.

CRM customer/payment mapping remains unavailable until actual table relationships and permissions are verified. Repair estimates are never used as payment amounts. Google Ads exports read only prepared ga_conversion_drafts; exporting does not upload conversions or mark them uploaded. No conversion drafts are fabricated from unverified CRM data.

## Verification

After redeployment, logged-out dashboard access must redirect to /login. A non-admin user must receive 403 for protected API routes. An approved administrator should see actual call counts. Re-importing an unchanged Sheet must insert zero duplicate rows. Confirming an already attributed click must be rejected by the database. Check the audit log after a settings change or confirmation.
