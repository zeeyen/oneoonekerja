

## Fix: "Cari Kerja" Infinite Loop in Bot Processor

### Problem
When a user is in `matching` state but has no jobs in their conversation state, the bot tells them to say "cari kerja" to search. However, when they do, the message routes back to `handleMatchingConversational` (because `onboarding_status` is still `matching`), which hits the same empty-jobs check again -- creating an infinite loop.

This is exactly what happened to user IKHWAN in the uploaded CSV:
1. No jobs found at 10km, bot asked to expand to 20km
2. User replied "Banting ?" instead of "ya"/"tidak"
3. Bot got stuck in the empty-jobs loop
4. User typed "cari kerja" 3 times -- all got the same loop response

### Root Cause
`detectJobSearchIntent()` (which recognizes "cari kerja", "find job", etc.) is only called inside `handleCompletedUserConversational`, never inside `handleMatchingConversational`.

### Fix (1 file)

**`supabase/functions/bot-processor/index.ts`**

Change the empty-jobs handler in `handleMatchingConversational` (around line 2926-2935) to:

1. **Detect job search intent** -- if the user says "cari kerja" or similar, immediately trigger a new search instead of showing the loop message
2. **Reset to completed state** -- if the message is not a search intent, set `onboarding_status` back to `completed` so the user can properly trigger a search on their next message

```text
Before (lines 2926-2935):
  if matchedJobs.length === 0:
    return "Cakap 'cari kerja' untuk mula cari"  --> LOOPS

After:
  if matchedJobs.length === 0:
    if detectJobSearchIntent(message):
      --> trigger findAndPresentJobsConversational(user)
      --> update state to matching with new results
      --> return job results
    else:
      --> reset onboarding_status to 'completed'
      --> return "Cakap 'cari kerja' untuk mula cari"
      --> next "cari kerja" will route to handleCompletedUser correctly
```

This ensures:
- If the user says "cari kerja" while in the empty-jobs matching state, it immediately searches for jobs
- If the user says something else, it resets to `completed` state, breaking the loop
- The "Banting ?" style messages (unrecognized replies during expand prompt) also get handled gracefully

