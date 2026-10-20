# GSMWEB ChatGPT connector

ChatGPT calls this application's tools through a remote MCP server. No OpenAI, Gemini or Ollama model API calls are made by this connector. Conversation stays in ChatGPT; this is not a way to embed a ChatGPT subscription inside the application's existing chat box. Hosting, Google access and ChatGPT plan availability remain separate requirements.

## Implemented boundaries

- `POST /api/mcp`: official SDK, stateless Streamable HTTP, JSON responses, 16 KiB request limit, no batches, no persistent server session.
- OAuth discovery at `/.well-known/oauth-protected-resource/api/mcp` and the root discovery URL. Unauthenticated POST requests receive a discovery challenge.
- Supabase OAuth 2.1 with PKCE, pre-registered client, exact callback allowlist, administrator-only consent at `/oauth/consent`. No shared API keys, browser cookies or Google tokens are accepted as MCP credentials.
- JWT verification checks asymmetric signatures against the configured Supabase JWKS, issuer, MCP-specific audience, expiry, age, `openid` scope, dedicated client ID and current membership of `ga_admins`. Ordinary Supabase browser tokens with audience `authenticated` fail.
- OAuth client access tokens must have a lifetime of at most 15 minutes. Revoking a grant prevents refresh; existing access tokens can survive until expiry. Removing an admin or client from the allowlist blocks the next request. Disable `MCP_ENABLED` to stop all access.
- Account is fixed by `GOOGLE_ADS_CUSTOMER_ID`, never supplied by the tool caller. The encrypted `google_ads_management` connection stays on the server. The separate Data Manager `google_ads` connection is not reused for reporting.
- Read tools have read-only annotations. Reporting only calls `googleAds:search`; token refresh can update encrypted credentials. No Ads mutations, uploads, raw SQL, raw GAQL, shell, source editing or automation-permission tools are exposed.
- Fixed reporting sections: campaign/day spend and conversions, current campaign budgets/bidding/network/location settings, search terms, keyword match types, devices, networks, countries, conversion action settings and conversion performance. Windows are 1, 7 or 30 completed days in the verified account timezone. Pagination, row limits, provider failures and identity mismatches fail without partial totals. Google privacy limitations still apply.
- Tracking health returns only saved freshness, currency, controls and aggregate upload states, never contact data, click IDs, connection secrets or CRM records.

## Setup before enabling

1. Confirm the Vercel project's connected GitHub repository is `waelmarnaoui/gsmweb-comparison`; its discovered project ID is `prj_wjlJItmZjo094NzZm7jFQZaTAzDG` in team `team_tcEUvZiBHoD9UGDZ6ujxupRw`. Listing succeeded but detailed access returned 403 during development, so deployment provenance and environment values remain unverified.
2. Keep `MCP_ENABLED=false` and `MCP_OPTIMIZATION_PROPOSALS_ENABLED=false`. Set `APP_URL` to the verified HTTPS deployment origin. Preview needs its own exact origin and dedicated OAuth client; do not point a preview's audience at production.
3. Use the app's existing Supabase Auth project. Discovery found `razskzqcijosftvyuipi` with GSMWEB tables, saved reporting for customer `2050434247`, and both Google connections. Confirm this matches Vercel before configuring Auth.
4. Enable Supabase OAuth 2.1 Server with authorization path `/oauth/consent`. Pre-register a dedicated ChatGPT OAuth client with authorization-code/refresh grants and PKCE S256. Add the exact redirect URI shown by ChatGPT (its callback can be connection-specific); do not guess it. Enter this client ID and callback in `MCP_OAUTH_CLIENT_IDS` and `MCP_OAUTH_REDIRECT_URIS`. Use a public client or enter its secret only in ChatGPT's secure OAuth setup, never in this repository or chat.
5. Configure a custom access-token hook for **only this dedicated client**, preserving existing hooks. Its signed claims must include `client_id`, `scope: "openid"`, `aud: "https://<verified-origin>/api/mcp"`, `iat`, `exp <= iat + 900`, and the signing-in admin's `sub`. Do not copy user-editable metadata into authorization claims. Give these tokens role `anon` so the MCP grant does not also inherit the admin's direct Data API privileges; the MCP server uses a fresh server-side admin check instead. Ordinary application sessions must retain their original claims.

   Hook logic to adapt inside the existing hook (not an applied migration):

   ```sql
   -- SECURITY INVOKER; empty search_path; execute granted only to supabase_auth_admin.
   -- Replace the client ID and resource below with the exact verified values.
   claims := event->'claims';
   if coalesce(event->>'client_id', claims->>'client_id') = '<dedicated-client-uuid>' then
     claims := claims || jsonb_build_object(
       'client_id', '<dedicated-client-uuid>',
       'scope', 'openid',
       'aud', 'https://<verified-origin>/api/mcp',
       'role', 'anon',
       'exp', least((claims->>'exp')::bigint, (claims->>'iat')::bigint + 900)
     );
   end if;
   return jsonb_build_object('claims', claims);
   ```

   Install/test through the Supabase hook workflow, preserve all required claims, and revoke function execution from PUBLIC/anon/authenticated. This repository does not install or enable an auth hook automatically. Test real OAuth tokens, refresh and revocation; do not weaken audience checks to `authenticated` to fix setup errors.

6. Verify the existing server environment, encrypted management connection and `GOOGLE_ADS_CUSTOMER_ID`. Do not paste refresh tokens, service-role keys or encryption keys into ChatGPT. A valid reporting connection still needs Google Ads API permission; this connector does not remove Google's API requirement.
7. Enable MCP on a preview after configuration. Test discovery, missing credentials (401), ordinary browser JWT (rejected), other clients (rejected), non-admin (403), correct admin token, refresh, denied consent, expired token and malicious Origin. Confirm tool listing exposes exactly two read tools. Run every reporting section against the live account, including a multi-page report. This live verification has not been completed locally.
8. Connect the verified HTTPS `/api/mcp` URL using ChatGPT's custom MCP setup with OAuth and scope `openid`. Complete consent as a GSMWEB administrator. A user must perform the final ChatGPT account linking; it cannot be done by this source patch. Account/workspace availability may vary.

## Optimization stage

Default release is read-only. If separately enabled later, `MCP_OPTIMIZATION_PROPOSALS_ENABLED=true` adds `propose_cost_reduction` for only `campaign_pause` and `budget_decrease`. It calls the existing exact-action proposal workflow and returns an action ID/review link. No approve or execute tool exists. The owner separately reviews and approves the exact change in GSMWEB; existing expiry, state conflict, unshared-budget, recovery-worker and protection checks still govern execution.

Currently `ADS_WEB_ONLY=true` in source and `protect_existing_ads=true` in the inspected account. Proposals are therefore blocked even if the MCP feature flag is enabled. This change intentionally preserves both. Removing protections or enabling execution requires a separate explicit owner decision after the diagnostic results. Budget increases, bidding changes, targeting changes and negative-keyword writes are not implemented.

## Initial findings, 20 October 2026

Read-only database inspection found:

- Latest saved report: 19 October 2026 at 09:25:10 Europe/Bucharest; its rolling report covers 12–18 October. The saved intraday zero is an early snapshot, not a completed-day report. It cannot confirm or refute the owner's reported $90 spend on 19 October.
- Account currency USD. Saved Search campaign GSMWEB used Maximize Conversions, with $393.975624 spend and 208 clicks for 12–18 October (approximately $1.89/click). That report does not include conversion counts. It is not evidence that conversions were zero.
- Conversion upload ledger: 17 `success`, 7 `submitted`, no warning flags in those groups. Counts span all stored dates, not just yesterday. `submitted` requires reconciliation; neither state proves attribution in Google Ads.
- Export code (`lib/conversion-dashboard.ts`, `lib/conversion-readiness.ts`) uses the website-click timestamp for some click-linked paid conversions; phone-only conversions use saved first-match times. Confirm intended conversion semantics against actual payment/repair events and Google's destination diagnostics. This is a tracking concern to investigate, not a proven explanation for low performance, and no timestamps were changed.

Next diagnostic order: yesterday's complete campaign report; compare 7/30-day results; conversion action primary status/type/windows and conversion performance; reconcile upload receipts with actual Google diagnostics and CRM event times; then rank search terms, match types, networks, devices and location segments by spend and conversion evidence. Do not cut budgets solely because conversion reporting may be delayed or broken.

## Verification

Run `pnpm test`, `pnpm typecheck` and `pnpm build`. MCP tests use synthetic keys, mocked Google responses and the real SDK client/transport. They never call a live Google mutation. Live OAuth linking and Google query compatibility must also pass before claiming the connection or diagnosis is complete.

References: [ChatGPT custom MCP setup](https://developers.openai.com/api/docs/guides/custom-mcp-server), [OpenAI OAuth requirements](https://developers.openai.com/plugins/build/auth), [Supabase MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication), [Supabase token customization](https://supabase.com/docs/guides/auth/oauth-server/token-security), [MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/server).
