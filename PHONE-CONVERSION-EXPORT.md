# Combined conversion export

One CSV contains click-linked and phone-only paid conversions. Headers are Google Click ID, Phone Number, Conversion Name, Conversion Time, Conversion Value, Conversion Currency and Order ID. Missing GCLIDs stay empty. Phone numbers are normalized to E.164 and SHA-256 hashed; names are not exported. The owner confirmed customer consent.

Import through Google Ads Data Manager enhanced conversions for leads. Map the columns, select the approved conversion action, and set timestamp parsing to yyyy-MM-dd HH:mm:ss with Europe/Bucharest timezone. Do not hash the already hashed phones again. Headers are the first row; no legacy Parameters row. Example: 2026-09-24 18:05:24.

Comparison starts at 24 September 2026 midnight Bucharest, replacing the previous 9 October cutoff. Older records are not deleted. Missing Android history must be uploaded by the phone; changing this filter cannot recover it.

Only actual positive active payments qualify. Visits must be within 14 days after a call. Click-linked assignments and existing drafts reserve payments first. Remaining payments use the newest eligible unmatched call; ties and ambiguous clients are excluded. Stable project/payment Order IDs and uniqueness prevent duplicates within a file. Date-only payments use assumed 23:59:59 Romanian time and are withheld until that time passes. Phone-only payments older than 63 days are withheld conservatively.

No automatic upload or delivery ledger is installed. Verify Google's customer-data terms, enhanced conversion setup and consent before importing. Google determines ad attribution; phone-only records are not confirmed Google Ads conversions. CRM production data and schema are unchanged.

References:
https://business.google.com/en-all/accelerate/resources/articles/prepare-your-data-for-import/
https://developers.google.com/google-ads/api/docs/conversions/upload-offline

