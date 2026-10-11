# Manual Google upload

Destination: Google Ads account 2050434247, conversion action 7835048106.

## Install before merging

Run `supabase/ADS-UPLOAD-PROPOSED.sql` only with approval in the attribution project razskzqcijosftvyuipi. The consent migration must already be installed. This migration creates only app-owned upload history, admin read access and a service-only atomic reservation function. It does not modify the separate CRM or send data.

## Manual workflow

Open `/review`, choose the Bucharest review day and Refresh or Match all. Source tabs show that day's website clicks, raw calls (including labelled follow-ups), and CRM repair entries. Separate controls import the sheet, match website clicks to first customer calls, and compare calls with CRM. Matching remains global: the day filter does not remove competing clicks or reset first-call history. Daily output is filtered by repair entry day, while preserving the actual earlier click timestamp. Disable Daily repair entries to use a conversion-time date range.

Repair eligibility follows the administrator's updated rule: exact normalized customer phone, unique CRM client and repair within 14 days of the first incoming/missed call, with known customerPrice and repairCost. Profit is customerPrice minus repairCost, including negative and zero. Payment and repair status are not eligibility gates. Actual recorded payments are shown separately, not described as repair profit. Sales retain the existing payment-based rule. One stable project:repair:ID identifies each repair; existing exported repair payments or upload ledger claims block re-upload. The first CRM-match timestamp for phone-only repairs is saved immutably in the existing app-owned observations table (its legacy crm_paid_date field stores repair entry date for repair keys).

Granted and the current Bucharest obtained time are only unsaved proposals until actual consent is attested and recorded by an administrator. Existing consent dates remain unchanged. Preserve actual refusal or withdrawal; never infer consent from silence. Record choices, review the saved data, check attestation and click Send. Send revalidates identifiers, consent revision, signed profit, time and ad identifiers against current server data. New unreviewed conversions are excluded. Google's validation runs before any upload reservation; negative-value acceptance is not assumed and rejected values are never silently clamped.

Each payment is atomically reserved once per account/action. No background scheduler uploads. Turn off any existing Google Drive/Sheets scheduled import yourself before switching to this API. Do not change transaction identifiers: historical imports outside this app cannot be detected in advance, but stable order IDs let Google detect duplicates within the same action.

The API sends saved GCLID/GBRAID/WBRAID when available, SHA-256 E164 phone, signed recorded repair profit (or allocated sale payment profit) in RON, original website-click or immutable first-CRM-match time, stable transaction ID and actual consent. Personalization not granted is conservatively sent as denied. Names, notes, invented identifiers and raw phone numbers are not sent. API timestamps use RFC3339 as Google requires; CSV keeps `YYYY-MM-DD HH:mm:ss` in Bucharest time.

Google Ads setup reads actual saved authorization and upload-history status. Destination validation is recorded only after Google accepts a validation-only request for the current account/action, and reconnecting clears this evidence. Signing into Google Ads in a browser does not authorize the app: Connect Google Ads must complete its separate OAuth callback.

## Result handling

Submitted means Google returned a receipt, not that attribution succeeded. Check Google status reconciles up to three pending requests per click. Success, partial and failed refer to request processing, not ad credit. Partial batches cannot be safely assigned row-level outcomes from aggregate counts. All reserved payments remain excluded from future sends, including failed, partial, timed-out, crashed or uncertain requests. There is deliberately no blind retry or automatic reservation expiry. Investigate these using Google diagnostics and the stored receipt before any separately reviewed recovery procedure.

Provider errors are sanitized to HTTP status and enum codes; customer identifiers and provider message bodies are not returned to the browser. API routes require authenticated admins and same-origin mutation requests. Credentials remain encrypted server-side. Live Google upload/attribution requires verification after deployment; local tests use synthetic data only.
