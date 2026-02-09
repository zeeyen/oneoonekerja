

## Bring `bot-processor` Edge Function into the Repository

### What will happen
The uploaded 2715-line source code will be added to the repository as `supabase/functions/bot-processor/index.ts` and the function config will be added to `supabase/config.toml`. Once saved, it will auto-deploy to Supabase, **replacing** the currently live version with identical code.

### Steps

1. **Create `supabase/functions/bot-processor/index.ts`**
   - Copy the uploaded file contents exactly as-is (all 2715 lines) into the project.

2. **Update `supabase/config.toml`**
   - Add the `bot-processor` function config with `verify_jwt = false` (matching the current deployment, as noted in the source comment: `Deploy: supabase functions deploy bot-processor --no-verify-jwt`).

### Secrets Check

The function uses these environment variables:
- `SUPABASE_URL` -- available in Supabase automatically
- `SUPABASE_SERVICE_ROLE_KEY` -- available in Supabase automatically
- `OPENAI_API_KEY` -- already configured in Supabase secrets
- `AGENCY_BASE_URL` -- optional, defaults to `https://101kerja.com/apply`

All required secrets are already configured. No action needed.

### Risk Assessment

- **Zero risk** -- the code is identical to what's currently running live. The first deployment will be a no-op functionally.
- Future edits can then be made directly in this repo and will auto-deploy.

