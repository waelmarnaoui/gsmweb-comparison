# Bulk ad workspace

Create Ads defaults to the bulk builder; the previous stock/search opportunities remain in a second tab. Five service categories, nine phone families (Samsung S and A separate), model checkboxes, 3 ads per group, and exact-only keywords are supported. A catalogue is a review shortlist, not evidence of Romanian search popularity, stock or service compatibility.

## Setup

Review `supabase/BULK-ADS-PROPOSED.sql` and obtain approval before installing it in the attribution database. It creates one server-only app table and an audit trigger; no CRM schema/data changes. No new OAuth secrets are required: manual submissions use the existing Google Ads management connection. Automatic account control remains paused. Owner-confirmed manual uploads are a separate create-only workflow for new PAUSED groups and never enable spending.

## Keywords

- Load 30-day searches explicitly; no Google requests on page load. Research can read past searches outside campaign serving hours without authorizing changes. Normal stock/search scheduling is unchanged.
- One account-wide, bounded report is saved in the existing audit store. Each explicit Load searches request can collect a new report; no application cooldown is enforced. Only this account's disclosed search terms are available; this is not a Keyword Planner search-volume study or a market-wide ranking. Google can omit terms for privacy. Google API limits still apply; rejected requests are not automatically retried.
- Rank observed terms by clicks and impressions. Retain the evidence window, exact term and metrics. Ambiguous models, wrong services, sensitive data, DIY and screen protectors are excluded. Glass and full-display intent remain separate.
- Unobserved model suggestions are opt-in and clearly identified. Without this opt-in, models with no observed keywords are uncovered, not silently given invented search evidence.
- Every keyword is EXACT. Stored keywords and all three ads enter the SAME new group in one atomic Google mutation. No broad/phrase path exists.
- Keyword insertion uses verified model-specific defaults only when all triggering terms fit the headline. A long triggering term requires a family-level fallback to avoid advertising a different model. Full model names remain in exact keywords and the coverage table.

## Manual submission

Prepare, review and save each family/service group. The server regenerates the preview from the saved keyword report; submission is bound to that exact stored hash, campaign and optional approved CPC. For a manual-CPC campaign the owner must explicitly enter a CPC in account currency. No budgets or bids on existing resources are changed.

The owner confirms service availability for targeted models and the saved copy. Submission creates one new PAUSED group and at most three ENABLED RSA ads; this means uploaded, not serving or policy-approved. Google review/activation remain separate. Existing ads and groups are never adopted or modified. A matching Google group name causes a stop, not append/overwrite.

One account lease and versioned state transitions fence each request. Validate first, persist the submitting intent, then send one atomic write (`partialFailure:false`). Missing resources/transport ambiguity leaves the request reserved; never automatically or manually resend it. Successful ingestion does not imply policy approval. Interrupted `validating`/`submitting` states require investigation. Known rejections may be reviewed and explicitly re-saved, not silently replayed.

Glass-only copy is conditional on panel/touch suitability. It does not guarantee original-part provenance, a price saving, repair time or compatibility for every model. The owner must remove unsupported models. Camera/glass support is scoped only to this manually approved workflow, not an expansion of the unattended stock publisher.

## Catalogue references

Manufacturer names are starting selections, not popularity measurements. Confirm models/services before submission:
- https://www.apple.com/ro/iphone/compare/
- https://www.samsung.com/ro/smartphones/galaxy-s/
- https://www.samsung.com/ro/smartphones/galaxy-a/
- https://www.mi.com/ro/mobile/
- https://www.honor.com/ro/phones/
- https://www.oneplus.com/ro/phone
- https://www.oppo.com/ro/smartphones/
- https://consumer.huawei.com/ro/phones/
- https://www.motorola.ro/smartphones

Google references: https://support.google.com/google-ads/answer/6371157 and https://developers.google.com/google-ads/api/docs/ads/mutate-ads
