# Protected Ollama chat

This optional provider uses llama3.1:8b on your computer. It supports text-only,
read-only advice from saved dashboard facts. Selecting Full Control does not grant
this model account tools. Gemini retains its existing authorized tools. No provider
fallback occurs when Ollama is selected. The Ads laptop worker stays disabled.

## Windows setup

1. Stop any ngrok tunnel that exposes port 11434 directly.
2. Keep Ollama running with llama3.1:8b installed.
3. From this project folder run `node scripts/ollama-gateway.mjs`.
4. In another terminal run `ngrok http 11435`.
5. Open the local file `%USERPROFILE%\.gsmweb-ollama\gateway-token.txt`.
   Keep this token private. Do not paste it into chat or commit it.
6. After deploying this version, open AI connection settings, select Ollama,
   enter the new HTTPS tunnel URL, and paste the token into the password field.
7. Select Connect and save. Only static test text is sent during this test.

The gateway accepts authenticated completion requests only and cannot expose model
pull/delete/create operations. Its upstream is fixed to local Ollama. Keep the
computer, gateway and tunnel running for chat. A restarted tunnel may require an
updated URL. For a lost token, stop the gateway, remove its local token file,
restart it and save the newly generated token in the app.

Chat requests pass through Vercel and ngrok before reaching your computer. This is
not an entirely local/private transport. Do not submit sensitive customer records
without an appropriate legal basis and review of those services' terms.

On Windows, restrict access to the local token file to your Windows account.
The gateway token is stored encrypted by the app using its existing connection
storage. No Supabase schema or CRM changes are required.

## Slow or incomplete responses

Chat is submitted as a background job on the local gateway, with a 30-minute
model deadline. The app checks status through short authenticated requests every
10 seconds while visible; Vercel never holds a request open for 30 minutes.
Status checks never restart generation. The settings connection test is still a
short static prompt with a four-minute deadline inside its 300-second route limit.
Hosting configuration must support that settings-test duration. The gateway keeps the
model loaded for 15 minutes and pins a 4096-token context. Replies use a schema
and a 1200-token ceiling. There are no automatic retries. Long user messages
within the existing 4000-character chat limit are not shortened. Saved context
and history are bounded; advice does not represent a full account audit.

When updating the gateway script, restart its terminal process. The token file
is retained, so do not regenerate or share the token. No tunnel change is needed
if the same tunnel still points at port 11435.

In-progress and completed local jobs are retained in gateway memory for up to one
hour; they are not persisted to disk. Restarting the gateway loses unfinished or
uncollected results. The app reports that outcome without resending. Completed
replies are saved to the existing app-owned chat history when collected. No new
tables are required. A disconnected computer or closed page delays collection,
not local generation. Return to chat within the retention period to collect it.
Only one model generation runs at a time. Context and token limits still apply;
30 minutes does not mean unlimited prompt or reply length.
