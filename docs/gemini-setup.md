# Gemini Setup

The app calls Google's Gemini API directly, not Claude or an AI Gateway. The default model is `gemini-3.8-flash`. No automatic provider/model fallback or SDK retry is enabled. The current browser-based voice input and spoken replies remain unchanged.

## Connect After Deployment

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/api-keys).
2. Open **AI Marketing > Settings & activity > Gemini connection settings**.
3. Enter the key in the password field. Leave the default model selected.
4. Click **Connect Gemini**. The server tests static text, then encrypts and saves the key only if the test succeeds.
5. Send a short message in AI chat to verify your own project access.

Never put the key in chat, source files or `NEXT_PUBLIC_` variables. The saved key is never returned to the browser. No schema migration or CRM change is required.

For environment-based setup instead, use server-only `GOOGLE_GENERATIVE_AI_API_KEY` (or `GEMINI_API_KEY`) and optional `GEMINI_ADVISOR_MODEL`. Verified encrypted Google settings take precedence. Previous Anthropic keys and model variables are ignored; replacing the saved connection requires explicitly saving a tested Gemini key.

## Costs And Data

Free quota is model/project dependent and is not guaranteed unlimited access. A billing-enabled Google project may charge for requests, including connection tests. The application cannot determine your project's billing tier from an API key. For free-only use, verify the project's tier and quota in AI Studio before connecting it. Quota errors stop the request without switching to a paid model or retrying account actions.

The selected model supports function calling, structured output and image/PDF input. Existing server permissions, approval gates and audit history continue to govern tool execution. Model output alone is not proof that a change executed.

Chat messages, attachments, bounded account context and explicitly requested tool results go to Google. Read the [Gemini data-handling terms](https://ai.google.dev/gemini-api/terms) before sending customer information. The static connection test contains no customer data. Switching providers does not change advertising consent or authorize new data sharing.
