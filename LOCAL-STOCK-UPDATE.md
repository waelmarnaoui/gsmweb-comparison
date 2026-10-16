# Receipt-based stock collection and local campaign brief

The owner confirmed gsmweb.site, Drumul Taberei 138 and a focus on neighbours in Drumul Taberei/Sector 6. The public website contact page confirms the address; the public hours page currently states Monday–Friday 11:00–19:00 and weekends by appointment. The supplied Maps share link could not be fetched by the research tool and is retained as owner-provided, not independently verified. The app displays these facts as a draft local campaign brief. No Google campaign, location, schedule or bidding setting is changed.

The proposed matching option is PRESENCE: people likely in or regularly in the selected locations, rather than people elsewhere merely showing interest. Google location matching is approximate. No exact radius or Google geo-target resource is invented; boundaries need verification before applying targeting. Nearby visibility is an optimization objective, not a guarantee of top placement or the cheapest click. The 3 RON CPC goal, fixed 4.74 RON/USD and previous-day payment spending cap remain intact.

Actual account evidence: the latest saved Google API review, fetched 2026-10-16T14:36:45.838Z, contains 13 ENABLED responsive search ads with approvalStatus APPROVED, reviewStatus REVIEWED and empty policy-topic lists. These existing ads are approved; do not describe them or the whole account as universally disapproved. New copy and new ad resources still require their own review. The source restrictions remain relevant to any new repair offer, and no approval is inferred beyond the exact reviewed ads.

## Stock collection fix

The old adapter scanned every generated catalogue product and assumed a page shorter than 500 rows meant completion. A lower PostgREST response cap can make this silently incomplete, while the source application can generate many catalogue templates without physical stock. Either can trigger rejected/incomplete evidence or a size limit. The actual observed production error remained unknown, so these are corrected failure paths, not a claim that the live root cause has been confirmed.

The reader now starts with all InventoryLot records, including quantityAvailable=0. It fetches only their referenced InventoryProduct records and the explicitly referenced DeviceModel rows, in bounded ID batches. It requests exact counts, advances by the actual returned row count, rejects changed counts, missing pages, duplicate identities and unreadable references, and keeps a 20,000-lot ceiling and the existing timeout. Catalogue templates without any stock lot are outside this received-stock scope and cannot generate an ad. Existing lots depleted by repairs remain visible. No repair allocation is deducted twice; no source table, quantity or credential is changed.

Safe diagnostics now separately identify pagination/count/size limits, duplicate identities, unreadable references and invalid configuration. Messages are mapped from known application errors; raw provider messages or credentials are not logged. Failure records still use the existing append-only history and audit structures. No new migration is needed.

Stock-based drafts now use the owner's gsmweb.site URL as a candidate destination. A high-risk destination review requirement remains, so providing a URL cannot falsely establish clearance. Existing consumer-repair policy checks remain in effect. Correct factual/editorial problems; do not conceal repair services or rotate wording to bypass Google enforcement.

## Deployment verification

Merge and deploy, then open the agent dashboard or /ai-ads. Check for the first successful received-stock snapshot or the new specific diagnostic. No successful production read is claimed from local tests. If a new diagnostic remains, use its code/table to fix the actual source access/schema problem. The Google Ads executor, approval/action ledger and independent pause recovery are still not implemented; this change does not enable full live control.

Sources checked:

- https://gsmweb.site/contact/
- https://gsmweb.site/program/
- https://developers.google.com/google-ads/api/docs/targeting/location-targeting
- https://supabase.com/docs/reference/javascript/using-modifiers-range
- https://github.com/supabase/tanstack-db (official Supabase adapter row-cap documentation)
