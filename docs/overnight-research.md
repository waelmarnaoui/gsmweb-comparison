# Local background research

## Available in this release

Owner-scoped tasks persist in the attribution database. The separate local
research process claims one task at a time, renews a fenced lease, saves a
checkpoint after each of three analysis/review/report stages, and resumes from
the last completed stage after an interruption. The browser can be closed.
Pause, cancel and worker revocation stop generation at the next heartbeat,
normally within a minute. Stale workers cannot commit newer results.

This release analyzes saved dashboard/search-term data only. It does not perform
public web searches or fetch a complete last-30-day keyword report. Those source
integrations remain outstanding. Explicit online/competitor research requests
are rejected rather than silently simulated. Reports must state actual saved
data coverage and missing evidence. Recommendations are not executed actions.

The task deadline can be 1–12 hours; individual model calls allow up to 30 minutes.
Tasks finish early if all stages complete. It does not keep generating for hours
merely to fill a time allowance. No advertising changes, CRM writes, policy
bypasses or repeated Google API polling occur. The old Ads worker stays disabled.

## Database

RESEARCH-QUEUE-PROPOSED.sql adds only ga_research_tasks, ga_research_workers and
their queue/checkpoint/audit functions. The owner approved applying it to
razskzqcijosftvyuipi. CRM remains untouched. Tokens are hashed in the database;
worker rows are never exposed directly to browser roles. Only signed-in owner
administrators can read their own tasks. Writes and queue RPCs are server-only.

## Pair the computer after deployment

1. Open the marketing agent and expand Background research → Research computer.
2. Click Pair this computer and Copy token. Do not send the token in chat.
3. Run scripts/start-research-worker.ps1 in PowerShell from the updated project.
4. Paste the RESEARCH pairing token into its hidden prompt, not the gateway token.
5. Keep Ollama running with llama3.1:8b, this process running, the computer awake
   and the internet connected. No administrator rights are required.
6. Queue a saved-data analysis task and review its status/report in the app.

The agent can also propose queue_research_task in Full Control mode. Review and
approve that exact task proposal before it is queued. The same source limits apply.

This research connection is outbound HTTPS to the production Vercel app and
local HTTP to 127.0.0.1:11434 only. It requires no ngrok tunnel. Chat still uses
its existing protected gateway/tunnel; this release does not remove that path.

The launcher stores its token encrypted with Windows DPAPI in
%USERPROFILE%\.gsmweb-ollama\research-worker.dpapi. For a replacement token, first
revoke the old worker in the app, stop its process, remove only that credential
file, and run the launcher again. Never copy credentials between Windows users.

## Verification

Run the normal tests plus tests/research-queue.test.ts and
tests/research-worker.test.ts. They exercise isolated Postgres grants/RLS,
fenced claims, checkpoint versions, expired lease recovery, stale write rejection,
worker resume, pause/lease-loss abort and invalid model output. Production schema
permissions are inspected separately. Live pairing/model/report generation still
needs verification after the app is deployed and the computer is paired.
