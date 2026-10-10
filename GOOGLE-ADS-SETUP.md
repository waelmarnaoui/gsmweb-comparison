# Google Ads Setup And Automation Status

Destination approved by the user: customer 2050434247, conversion action 7791753827, name GSMWeb CRM - All records from GSMWeb CRM.

Implemented in this update:
- The first dashboard screen shows ready-for-CSV converted clients, with Romanian date filters.
- Confirmed Google Ads calls match customer visits at most 14 days later. Each active recorded payment is assigned to the latest eligible confirmed call. Equal-time ties are excluded. Old repairs and past customer payments are not used.
- Conversion time is 23:59:59 Europe/Bucharest on paidDate, as explicitly approved. Today's date-only payments remain pending until that time has passed. This is an assumed time, not an exact payment time recorded in the CRM.
- Payment IDs include the source CRM project reference. App-owned conversion drafts are inserted idempotently and audited. Existing drafts are not silently reassigned. Export revalidates current CRM payments and attribution.
- CSV timestamps use YYYY-MM-DD HH:mm:ss with an explicit Europe/Bucharest timezone parameter. Nothing is uploaded to Google automatically by this update.
- Separate /ads OAuth connection with its own Google Cloud client credentials; it does not overwrite Google Sheets authorization. OAuth authorization is not yet verification of the selected Ads account or action.

Setup required:
1. Use the Google Cloud project for the Ads account. Enable Data Manager API and configure consent for https://www.googleapis.com/auth/datamanager. Add the intended Ads login as a test user if necessary. Testing refresh tokens may expire; production consent setup must be completed for durable operation.
2. Create a Web application OAuth client. JavaScript origin: https://gsmweb-comparison.vercel.app. Redirect URI: https://gsmweb-comparison.vercel.app/api/integrations/google_ads/callback.
3. Save GOOGLE_ADS_OAUTH_CLIENT_ID and GOOGLE_ADS_OAUTH_CLIENT_SECRET as server-only Production Vercel variables. Keep existing GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET unchanged for Sheets.
4. Review and explicitly approve supabase/ADS-CONNECTION-PROPOSED.sql. It changes only the allowed IDs of app-owned ga_connections, in the attribution project. Do not run it in the CRM database. No production SQL was executed by the agent.
5. Merge and deploy the update, then authorize the intended Google account at /ads. Destination validation and transport still need implementation and live testing before enabling uploads.

Remaining automatic workflow work:
- Implement Data Manager event ingestion and asynchronous status reconciliation, stable transaction IDs, durable claims, unknown-outcome handling, and failed-upload diagnostics. An HTTP acceptance is not proof that a conversion was processed or attributed.
- Install a protected half-hour job to read Sheets, match calls, read CRM payments, prepare eligible drafts and submit validated unsent conversions. Vercel Hobby's own Cron Jobs only run once daily. A supported external scheduler or a plan with finer scheduling is required. No scheduler has been installed by this update.
- Android call collection depends on the APK's own background uploader; a server job cannot read new phone logs until the device has uploaded them.
- Conversion corrections/refunds need an explicit adjustment workflow; this update blocks changed drafts rather than silently modifying exported data.

Official references:
- https://developers.google.com/data-manager/api/reference/rest/v1/events/ingest
- https://developers.google.com/data-manager/api/reference/rest/v1/requestStatus/retrieve
- https://developers.google.com/google-ads/api/docs/conversions/upload-offline
- https://vercel.com/docs/cron-jobs/usage-and-pricing

