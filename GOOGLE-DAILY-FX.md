# Google exchange rate and reporting refresh

## Deployment

Deploy this source revision using the existing manual deployment workflow. No Chrome access, spreadsheet edits, new OAuth scopes, secrets or database migrations are needed. The existing Google Ads management OAuth and developer token remain necessary for reports. No Google Ads mutation is added.

## Exchange rate

The server reads the fixed public Google Finance USD/RON page. It parses the JSON quote payload without executing scripts, verifies both currency codes and the pair identifier, validates the numeric price and quote timestamp, and rejects inconsistent quotes. Identical duplicate payloads are accepted. Responses, redirects and content size are bounded. Consent pages, markup changes, invalid data and access failures leave lei comparisons unavailable with an accurate retry notice.

The non-secret quote is cached using Next.js Data Cache with the Bucharest business date as an argument/key. Tomorrow gets a new cache entry. Failed reads are retried on later dashboard requests. The old database's existing daily Sheets captures remain readable and retain their original provenance; no new Sheets access or write is performed. Cache eviction or simultaneous cold requests may cause another reference capture, so this cache is not an immutable accounting ledger.

The quote timestamp is shown when available. Quotes up to four days old are accepted for market closure carryover, with the actual source time visible; older or future quotes are rejected. This is a Google reference estimate, not an official central-bank fixing or bank billing rate. Google's public page is not a supported currency API and can change or block server requests. Failure remains visible; no other provider or hardcoded rate is substituted. For audited long-term FX accounting, add a reviewed provenance-aware database capture later.

Original USD metrics remain intact. Both consecutive spend snapshots use the same daily rate so FX movement does not masquerade as extra spend. Seven-day totals converted with the daily capture remain estimates, not historical FX accounting.

## Monitoring

Authenticated optimizer and agent reads check the newest stored report. A missing, invalid, future or at-least-five-minute-old report triggers read-only Google Ads collection. Fresh reports are reused; overlapping calls share a promise within the server instance. Existing account/five-minute database uniqueness prevents duplicate stored snapshots across instances. Failed API calls are reported, preserve the saved report's original timestamp and back off for one minute per instance. There is no claim of distributed API-call locking.

Existing dashboard polling every 30 seconds drives this refresh while the dashboard is open. Closed dashboards require an external authenticated scheduler calling the existing /api/optimizer/cron endpoint. This change does not provision a scheduler or promise unattended 24/7 monitoring. Google reporting itself can be delayed even after a successful collection.

## Validation

Parser verified against the actual Google response fetched through the system HTTP client, including price and UTC quote timestamp. Direct Node live fetching failed on this local machine with a generic network transport error; the deployed server's network path therefore still needs verification after deployment. Unit tests exercise the complete fetch/parse path with simulated HTTP responses, malformed/duplicate/wrong-pair quotes, timestamp checks, report coalescing, failure visibility and cooldown. No live Ads changes were performed.

Official references: https://www.google.com/finance/quote/USD-RON?hl=en and https://nextjs.org/docs/app/api-reference/functions/unstable_cache .
