# Keywords Workspace

## Pages

- `/optimizer/keywords`: date-filtered Google Ads search terms, conversion-ranked repair keyword candidates, manual bulk match-type publishing.
- `/optimizer/keywords/budget`: keyword/ad/campaign spend, current Quality Score components, performance advice, reviewed pause/removal.
- `/optimizer/keywords/search-console`: property-owned organic queries and equal-length prior-period comparison.
- `/optimizer/keywords/demand`: Keyword Planner Google Search estimates for Romania or worldwide, all languages, with monthly volumes.

Search Console is not Google-wide Trends data. Keyword Planner is estimated topic-based demand, not a complete feed of Google searches or real-time Trends.

## Database

Run `supabase/KEYWORD-WORKSPACE-PROPOSED.sql` only in the approved attribution project, not CRM. It adds report/action storage with RLS, server-only writes, immutable submission intent, audit logging and an additional supported connection ID. It does not change CRM records or submit Google actions.

## Search Console

Uses the existing server-side `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`, but a separate encrypted connection and read-only scope. Google Sheets selection/credentials are not overwritten.

1. Enable **Google Search Console API** in that OAuth client's Cloud project.
2. Add the exact authorized redirect URI to the web OAuth client:
   `https://gsmweb-comparison.vercel.app/api/integrations/google_search_console/callback`
3. Add `https://www.googleapis.com/auth/webmasters.readonly` to the consent-screen data access configuration. Follow Google's verification requirements, or add the intended account as a test user while testing.
4. Open **Keywords > My website > Connect Search Console**. Sign in as an account with access to the relevant property, then select it.

## Google Ads

Reuses the existing `google_ads_management` OAuth connection and configured customer/manager. No secret belongs in the browser. Reports collect only on manual refresh, reuse a successful snapshot for 10 minutes, and never poll or retry errors. Keyword Planner results reuse a successful same-input snapshot for 24 hours.

Reports use the Google Ads account currency and timezone. Search Console dates use Pacific time. A missing Quality Score or absent prior organic query is shown as unavailable, not zero. API-hidden search terms cannot be reconstructed.

## Manual changes

All match types are available in this explicit owner-reviewed workflow. Existing bulk-ad exact-match rules are unchanged. Publish status defaults to PAUSED. Enabling is an explicit choice and may spend money if parent resources are active.

Review saves an immutable plan. Confirmation rereads Google, validates the exact operations, acquires an account lease and atomically reserves the request before sending. Uncertain operations stay blocked; never automatically resend them. Removal requires typing REMOVE. Pause is the reversible alternative. No automated advice directly changes bids, budgets, keywords or ads.

## Verification

Unit/provider tests: `tests/keyword-workspace.test.ts`.
Local PostgreSQL access/state tests: `node tests/keywords.sql-test.mjs`.
Do not test with a real Google mutation. Use mocked provider/browser flows and real read-only account checks after deployment.
