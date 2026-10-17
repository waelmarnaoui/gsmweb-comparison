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
