# Owner-approved fixed USD/RON rate

The owner replaced the Google daily-rate requirement with an explicit fixed rate: **1 USD = 4.74 RON**.

The active server conversion path uses this value directly, identifies its source as owner_fixed, and performs no Google Finance, Sheets, database or OAuth rate lookup. The UI describes it as an owner-approved fixed assumption, not a live quote. No new migration, key or environment variable is needed for FX. Deploy the source change to activate it.

Original USD observations remain unchanged. Lei spend, CPC comparisons, both consecutive pacing snapshots and historical summaries use the same 4.74 multiplier. Banks and actual billing may use another rate. Other account currencies remain unsupported; RON accounts need no conversion. The business date/capture fields identify the current reporting context, not a market quotation.

The old Google-rate parsers and historical database captures remain for compatibility and tests, but are not invoked by the active conversion provider. No historical records have been overwritten.
