# Manual Google upload

Destination: Google Ads account 2050434247, conversion action 7835048106.

## Install before merging

Run `supabase/ADS-UPLOAD-PROPOSED.sql` only with approval in the attribution project razskzqcijosftvyuipi. The consent migration must already be installed. This migration creates only app-owned upload history, admin read access and a service-only atomic reservation function. It does not modify the separate CRM or send data.

## Manual workflow

Open `/review`, choose the date range and refresh. Granted is only a proposal until actual consent and its obtained time are recorded by an administrator. Preserve actual refusal or withdrawal; never infer consent from silence. Record the choices, review the saved data, check the attestation and click Send. Send revalidates the reviewed payment identifiers, consent revision, profit, time and ad identifiers against current server data. New unreviewed conversions are excluded. Google validation runs again before any upload reservation.

Each payment is atomically reserved once per account/action. No background scheduler uploads. Turn off any existing Google Drive/Sheets scheduled import yourself before switching to this API. Do not change transaction identifiers: historical imports outside this app cannot be detected in advance, but stable order IDs let Google detect duplicates within the same action.

The API sends saved GCLID/GBRAID/WBRAID when available, SHA-256 E164 phone, actual profit in RON, original website-click or immutable first-paid-match time, payment transaction ID and actual consent. Personalization not granted is conservatively sent as denied. Names, notes, invented identifiers and raw phone numbers are not sent. API timestamps use RFC3339 as Google requires; CSV keeps `YYYY-MM-DD HH:mm:ss` in Bucharest time.

## Result handling

Submitted means Google returned a receipt, not that attribution succeeded. Check Google status reconciles up to three pending requests per click. Success, partial and failed refer to request processing, not ad credit. Partial batches cannot be safely assigned row-level outcomes from aggregate counts. All reserved payments remain excluded from future sends, including failed, partial, timed-out, crashed or uncertain requests. There is deliberately no blind retry or automatic reservation expiry. Investigate these using Google diagnostics and the stored receipt before any separately reviewed recovery procedure.

Provider errors are sanitized to HTTP status and enum codes; customer identifiers and provider message bodies are not returned to the browser. API routes require authenticated admins and same-origin mutation requests. Credentials remain encrypted server-side. Live Google upload/attribution requires verification after deployment; local tests use synthetic data only.
