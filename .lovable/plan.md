

## Sync Plan: Modular Bot Processor Rewrite

### What I Understand

You've refactored the monolithic `bot-processor/index.ts` (~4,172 lines) into **25 focused TypeScript modules** outside of Lovable. The `LOVABLE-SYNC.md` describes the full file inventory and 6 bug fixes. I can see the file inventory partially (entry point, config/types, core pipeline, and the start of handlers).

### Current State in Lovable

- `supabase/functions/bot-processor/` contains only the single monolithic `index.ts`
- No other modules exist yet

### What I Need From You

1. **Upload the zip file** containing all 25 `.ts` files (excluding backup files like `index.ts.pre-split`, `index.ts.OG-backup`, `index.ts.ck-codex-01`)
2. I will then:
   - Delete the old monolithic `index.ts`
   - Create all 25 new module files in `supabase/functions/bot-processor/`
   - Skip documentation-only files (`HANDOFF.md`, `LOVABLE-SYNC.md`) unless you want them in the repo
   - Deploy the updated edge function

### Risks / Things to Verify

- **Deno compatibility**: Edge functions run on Deno, so imports must use Deno-compatible syntax (no bare Node.js imports). I'll check each file for this.
- **Supabase client initialization**: The new `config.ts` must use `Deno.env.get()` for secrets, matching what's already configured (OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WA_ACCESS_TOKEN, etc.)
- **No new secrets needed**: Based on the file inventory, the same environment variables are used — no new secrets to add.
- **Testing after deploy**: The edge function deploys immediately, so the WhatsApp bot will start using the new code right away. Consider testing with a known number before going live.

Ready when you upload the zip.

