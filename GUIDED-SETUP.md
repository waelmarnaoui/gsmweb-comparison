# Guided connections: two Supabase accounts and Google Drive

Settings > Set up connections opens /connections. Call logs and CRM have independent Supabase OAuth authorizations, so different provider accounts can be used. Google Drive has its own authorization and spreadsheet picker. Existing service-account Sheets imports remain available when no Google OAuth connection has been saved.

This update is source code, not a completed provider deployment. It requires the one-time registrations below and explicit approval for the new connection-storage tables. No existing CRM table or production data is changed by publishing the code.

## Architecture and limits

- The original Supabase project remains the app's identity, administrator/RLS and attribution database. The call-project picker verifies that project only. Choosing a different app/auth database requires a separate migration and is intentionally rejected.
- The CRM slot can connect a different Supabase project in a different account. Project selection validates read access to Client, Repair, GoogleAdsLeads, PaymentTransaction, RepairSettlement and SaleSettlement. These are read-only operations. Selecting a project does not copy, migrate or modify CRM records.
- CRM health checks use the selected second database. Customer/payment mapping still requires the real column relationships; connection alone does not create attribution or revenue.
- Android uploads continue to their existing database/endpoint. This does not remotely redirect the phone collector.
- OAuth access/refresh tokens and CRM API keys are encrypted using AES-256-GCM with per-connection authenticated context. Encryption keys and OAuth client secrets stay in Vercel, outside the database.
- App administrators authorize integrations. Connections are shared by approved workspace administrators, not public or anonymous users. Connection records have RLS enabled and no client grants. Server operations check the original project's administrator session first.
- Google Picker requires a short-lived Google access token in browser memory. Refresh tokens, Supabase management tokens and project secret keys are never returned to the browser. Picker access is limited to drive.file; Google grants access to files the user selects. The app calls only read APIs for those files.
- Credential changes produce an app-owned connection audit record. No raw secrets appear in audit data. Provider consent scopes, not the app's UI, determine what the provider token can do. Protect the app's administrator accounts accordingly.

## Approval-required storage

Review supabase/CONNECTIONS-PROPOSED.sql. With approval, install it once in the current attribution project, not the CRM project. It creates only ga_connections and ga_connection_audit, a trigger, and restricted service-role grants. It is transactional but intended as a one-time migration, not repeatedly runnable.

Set SUPABASE_SERVICE_ROLE_KEY in Vercel to the current attribution project's rotated server secret. The name is retained for compatibility; either a supported server secret or legacy service-role key may be used. Never prefix it with NEXT_PUBLIC_. This secret is used only after administrator authorization for app-owned connection storage.

Generate a random 32-byte encryption key and encode it as base64. Set CONNECTION_ENCRYPTION_KEY to that value. Keep the same key across redeployments and back it up securely. Changing it without re-encrypting rows makes saved connections unreadable. Do not use passwords as encryption keys.

Set APP_URL=https://gsmweb-comparison.vercel.app. Separate preview environments need their own explicitly registered APP_URL/callbacks, database and encryption key; do not share live integration storage with arbitrary preview deployments.

## Google one-time registration

1. In one Google Cloud project enable Google Drive API, Google Sheets API and Google Picker API.
2. Configure OAuth consent and add the intended Google account as a test user while in testing mode. Request only https://www.googleapis.com/auth/drive.file. Google's testing-mode refresh tokens may expire; publish/verify the app as required by Google's policies for durable use.
3. Create a Web application OAuth client. Register JavaScript origin https://gsmweb-comparison.vercel.app and exact redirect URI https://gsmweb-comparison.vercel.app/api/integrations/google/callback.
4. Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to Vercel.
5. Create a Picker API developer key in the same project. Restrict its website origins to this app and https://docs.google.com/*, and its APIs to Google Picker API and Drive API, following Google's Picker requirements. Save as GOOGLE_PICKER_API_KEY. This restricted developer key is intentionally returned to the Picker, not treated as a privileged server secret.
6. Set GOOGLE_CLOUD_PROJECT_NUMBER to that same project's numeric project number, not project name/ID.
7. Redeploy. In /connections choose Connect Google Drive, approve file access, and Choose spreadsheet. Sheet IDs and names are validated server-side. Header/timezone checks still happen before importing, through the existing importer.

No service-account JSON is necessary for this guided flow. Do not revoke a service-account key being used elsewhere without reviewing its consumers. Previously exposed keys should be rotated.

## Supabase one-time registration

1. In the owning Supabase organization's Settings > OAuth Apps create/publish a Management API OAuth app. Configure only Projects Read and Secrets Read; no project/table write scopes are required.
2. Register both exact callback URLs:
   - https://gsmweb-comparison.vercel.app/api/integrations/supabase_calls/callback
   - https://gsmweb-comparison.vercel.app/api/integrations/supabase_crm/callback
3. Save SUPABASE_OAUTH_CLIENT_ID and SUPABASE_OAUTH_CLIENT_SECRET in Vercel; redeploy.
4. Connect the calls account and select the original attribution project. Connect the CRM account independently and select the second project. Supabase may reuse its currently signed-in browser account: switch accounts on Supabase before authorizing the other slot if necessary. These slots retain independent tokens.
5. CRM project selection retrieves an existing secret/service-role API key server-side through Secrets Read and verifies table access. No key is created. The key has broad database privileges despite this app using read-only CRM calls; use an appropriately controlled project/account and approve this access only if acceptable.

Supabase Auth login to this app is distinct from the Supabase Management account login. Selecting the CRM project must not replace NEXT_PUBLIC_SUPABASE_URL or its publishable key.

## Verification checklist

- Signed-out /connections redirects to app login. Every integration API requires a current approved administrator.
- Non-admin and cross-origin mutation requests are rejected.
- OAuth callback requires a matching, short-lived state and the same administrator. PKCE verifier and state are encrypted in an HttpOnly cookie.
- Project selection rejects arbitrary hosts, refs not listed by the authorizing account, and mismatched call/auth projects.
- Google picker cancellation leaves the previous selection unchanged. An inaccessible or non-Sheets file is rejected before saving.
- Repeated imports use the selected spreadsheet ID in deduplication keys and must not insert duplicate clicks.
- Disconnect removes the saved slot and logs the action without deleting call or CRM data. Existing environment-based service-account imports, if configured, remain independent. Revoke provider grants at the provider too if access should be removed there; disconnect does not revoke a shared provider account grant. Reconnect replaces only that slot.
- Build/unit/UI tests can run locally without provider credentials; real consent, refresh, RLS and external-project reads must be tested after approved registration/storage deployment.

Official references:
- https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration
- https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration/oauth-scopes
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/workspace/drive/picker/guides/web-picker-sample
