# Daily Google USD/RON capture

The owner selected Google's everyday exchange rate for lei reporting and alerts. The existing Google Drive/Sheets connection reads a dedicated `FX` tab in the already selected click spreadsheet. No new provider, API key or Ads write permission is used.

One-time setup in that spreadsheet:

| Cell | Content |
|---|---|
| FX!A1 | `USD/RON` |
| FX!B1 | `=GOOGLEFINANCE("CURRENCY:USDRON")` |

Wait for a numeric result in B1. Leave the click-import tab as it is. Apply `supabase/ADS-DAILY-FX-PROPOSED.sql` in the attribution database and deploy the source update. No Vercel settings are required for this feature.

The first successful dashboard/agent read on each Europe/Bucharest calendar day captures one current GoogleFinance value. Concurrent readers use a unique account/day key; the winning value remains fixed for that day, and tomorrow gets a new capture. GOOGLEFINANCE recalculates in Sheets; the app checks that the rate cell actually contains the expected formula, not a manually typed number. Both numeric and formula reads must succeed. Failed capture is retried on the next request, and missing/invalid rate leaves lei comparisons unavailable. No alternative provider or guessed fixed rate is used.

Rate date means app capture date, not Google quote timestamp. The current quote timestamp is unavailable through this read. The captured price may be delayed or carried over when markets are closed. Google rates are reference estimates, not the bank/card billing rate. Historical seven-day summaries converted with today's capture are explicitly estimates at today's rate, not historical day-by-day FX accounting. Original USD observations remain intact. Both consecutive spend snapshots use the same daily rate to prevent FX changes from becoming false spend increases. No Ads mutations or automated budget enforcement are enabled.

The change needs a source deployment before the UI warning changes. The daily capture is lazy; it does not create a new unattended scheduler. Existing collection/scheduler activation remains separate.

References: [GOOGLEFINANCE documentation](https://support.google.com/docs/answer/3093281), [Google Finance USD/RON](https://www.google.com/finance/quote/USD-RON?hl=en).
