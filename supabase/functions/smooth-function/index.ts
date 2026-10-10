import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Server is not configured" }, 503);
  const token = req.headers.get("Authorization")?.match(/^Bearer ([A-Za-z0-9_-]{43,128})$/i)?.[1];
  if (!token) return json({ error: "Device token required" }, 401);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  const tokenHash = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
  const { data: device, error: deviceError } = await db.from("ga_devices").select("id,active").eq("token_hash", tokenHash).maybeSingle();
  if (deviceError) return json({ error: "Device lookup failed" }, 503);
  if (!device) return json({ error: "Invalid device token" }, 401);
  if (!device.active) return json({ error: "Device revoked" }, 403);
  const deviceId = device.id;
  try {
    const reader = req.body?.getReader();
    if (!reader) return json({ error: "Missing body" }, 400);
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > 65536) { await reader.cancel(); return json({ error: "Payload too large" }, 413); } chunks.push(value); }
    const buffer = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder().decode(buffer));
    if (!Array.isArray(body.calls) || body.calls.length < 1 || body.calls.length > 100) return json({ error: "Invalid batch" }, 400);
    const rows = body.calls.map((call: Record<string, unknown>) => {
      if (!call || typeof call.event_id !== "string" || !/^[\w:-]{1,100}$/.test(call.event_id) || typeof call.phone !== "string" || !/^\+[1-9][0-9]{7,14}$/.test(call.phone) || typeof call.started_at !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(call.started_at) || !Number.isFinite(Date.parse(call.started_at)) || typeof call.duration_seconds !== "number" || !Number.isInteger(call.duration_seconds) || call.duration_seconds < 0 || call.duration_seconds > 86400 || !["incoming", "outgoing", "missed"].includes(String(call.direction))) throw new Error("Invalid record");
      return { device_id: deviceId, external_id: call.event_id, phone: call.phone, started_at: new Date(call.started_at).toISOString(), duration_seconds: call.duration_seconds, direction: call.direction };
    });
    const { data, error } = await db.from("ga_calls").upsert(rows, { onConflict: "device_id,external_id", ignoreDuplicates: true }).select("id");
    if (error) return json({ error: "Call import failed" }, 500);
    const { error: auditError } = await db.from("ga_audit").insert({ actor: null, action: "ANDROID_DEVICE_SYNC", entity: "ga_calls", record_id: deviceId, details: { device_id: deviceId, received: rows.length, inserted: data?.length ?? 0 } });
    if (auditError) return json({ error: "Calls received, but sync audit failed. Retrying is safe." }, 500);
    return json({ ok: true, received: rows.length, inserted: data?.length ?? 0 });
  } catch { return json({ error: "Invalid request" }, 400); }
});

