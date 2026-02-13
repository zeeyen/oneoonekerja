

## Fix: "Thanos" (and all messages) Blocked by Bot-Processor Auth Check

### Root Cause

The recent security fix added an `x-bot-secret` header validation at line 443-448 of `bot-processor/index.ts`. This check requires:

1. `META_APP_SECRET` to be set as an edge function secret
2. The caller to send `x-bot-secret` header matching that secret

**Neither condition is met.** `META_APP_SECRET` is not configured in the edge function secrets (only `LOVABLE_API_KEY`, `RESEND_API_KEY`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SUPABASE_URL` exist). Because `Deno.env.get('META_APP_SECRET')` returns `undefined`, the `!expectedSecret` condition is always true, and **every request is rejected with a 401** before reaching any bot logic.

This is why "Thanos" and all other messages return "Maaf, sistem sedang sibuk" -- the upstream webhook handler receives a 401 from bot-processor and sends that generic error to WhatsApp.

### Fix

**Two options (need your input on which caller sends the request):**

**Option A (Recommended -- Quick fix):** Make the auth check non-blocking when `META_APP_SECRET` is not configured. If the secret exists, enforce the header check. If it doesn't exist, allow the request through with a warning log. This restores functionality immediately while keeping the security layer ready for when the secret is added.

```text
Before:  if (!expectedSecret || requestSecret !== expectedSecret) → BLOCK
After:   if (expectedSecret && requestSecret !== expectedSecret) → BLOCK
         if (!expectedSecret) → WARN and ALLOW
```

**Option B:** Add `META_APP_SECRET` as an edge function secret AND ensure the upstream webhook handler (which calls bot-processor) sends the `x-bot-secret` header. This requires knowing the external caller's configuration.

### Changes

**File: `supabase/functions/bot-processor/index.ts`** (lines 441-448)

Replace the strict auth block with a graceful fallback:
- If `META_APP_SECRET` is configured and the header doesn't match: reject with 401 (secure)
- If `META_APP_SECRET` is not configured: log a warning and allow the request through (operational)

Then redeploy the edge function.

### Technical Detail

The only code change is in the `serve()` handler at the top of the main request flow -- approximately 5 lines replaced. No other files are affected.
