

## Add Tracking Parameters to Job URLs in Bot Messages

### Summary
Append `?source=chatbot&source_id=<applicant UUID>` to job URLs displayed during chat. No database changes needed — this is display-only at message generation time.

### Helper Function
Create a utility function `appendTracking(url: string, userId: string): string` that appends tracking query params, handling URLs that may already have a `?` query string.

### Files to Change

| File | Change |
|---|---|
| `supabase/functions/bot-processor/helpers.ts` | Add `appendTracking(url, userId)` helper |
| `supabase/functions/bot-processor/jobs.ts` | In `formatJobsMessage`: pass `userId` param, apply tracking to `applyUrl` (line ~290). Update `findAndPresentJobsConversational` to pass `user.id` through to `formatJobsMessage` |
| `supabase/functions/bot-processor/matching.ts` | In job selection handler (line ~177): apply tracking to `applyUrl` before displaying and saving |
| `supabase/functions/bot-processor/shortcode.ts` | Apply tracking to shortcode job URLs if applicable |

### Helper Logic
```typescript
export function appendTracking(url: string, userId: string): string {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}source=chatbot&source_id=${userId}`
}
```

### Key Points
- `formatJobsMessage` currently doesn't receive `userId` — signature updated to accept it
- Tracking URL is what gets displayed AND saved to `job_selections.apply_url` (so the landing site can attribute the click)
- The `last_selected_job.url` in conversation state will also contain the tracked URL for consistency
- No changes to the `jobs` table

