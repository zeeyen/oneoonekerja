

## Progressive Radius Expansion When No Jobs Found

### Overview
When the bot finds 0 jobs within the default 10km radius, instead of immediately showing a "no jobs" dead-end, the bot will ask the user if they want to expand their search. If they say yes, it searches at 20km, and if still nothing, at 50km.

### Flow

```text
User sends location
  -> Search 10km radius
     -> Jobs found: show them (no change)
     -> 0 jobs found:
        Ask: "No jobs within 10km. Want to expand search?"
        User replies YES:
          -> Search 20km radius
             -> Jobs found: show them
             -> 0 jobs found:
                Ask: "Still no jobs within 20km. Want to expand to 50km?"
                User replies YES:
                  -> Search 50km radius
                     -> Jobs found: show them
                     -> 0 jobs: "Sorry, no jobs within 50km. Try different location."
                User replies NO:
                  -> "Try different location by replying 'semula'."
        User replies NO:
          -> "Try different location by replying 'semula'."
```

### Changes (all in `supabase/functions/bot-processor/index.ts`)

#### 1. Update `findAndPresentJobsConversational` to accept a radius parameter
- Change `MAX_RADIUS_KM` from a hardcoded `10` to a function parameter with default `10`.
- When `nearbyJobs.length === 0`, instead of returning a final "no jobs" message, return a new flag indicating expansion is available.
- Return object gains: `{ message, jobs, noJobsAtRadius?: number, scoredJobs?: [...] }` so the caller knows which radius failed and can re-filter without re-querying.

#### 2. Add conversation state for radius expansion
- When 0 jobs at 10km: set `conversation_state` to `{ expand_search_pending: true, current_radius: 10, scored_jobs: [...] }` and prompt the user.
- When 0 jobs at 20km: set `current_radius: 20` and prompt again.
- When 0 jobs at 50km: show final "no jobs" message.

#### 3. Handle user's "yes/no" reply to expand search
- In all places that call `findAndPresentJobsConversational` and then store state, check `conversation_state.expand_search_pending`.
- Add a handler: when user is in `matching` status with `expand_search_pending: true`, detect yes/no:
  - **Yes** (ya/yes/ok/是/1): Re-filter `scoredJobs` at the next radius tier (20km or 50km).
  - **No** (tak/no/不/2): Show "try different location" tip.

#### 4. Localized prompt messages
- **10km -> ask expand to 20km:**
  - ms: `Maaf, tiada kerja dalam radius 10km dari {location}.\n\nNak Kak Ani cari dalam radius 20km?\n\nBalas 'ya' atau 'tidak'.`
  - en: `Sorry, no jobs within 10km of {location}.\n\nWould you like to expand the search to 20km?\n\nReply 'yes' or 'no'.`
  - zh: `抱歉，{location}10公里范围内没有工作。\n\n要扩大到20公里搜索吗？\n\n回复"是"或"不是"。`

- **20km -> ask expand to 50km:**
  - ms: `Masih takde kerja dalam 20km. Nak cuba cari dalam 50km?\n\nBalas 'ya' atau 'tidak'.`
  - en: `Still no jobs within 20km. Want to try 50km?\n\nReply 'yes' or 'no'.`
  - zh: `20公里内还是没有工作。要试试50公里吗？\n\n回复"是"或"不是"。`

- **50km final no jobs:**
  - ms: `Maaf, tiada kerja dalam 50km dari {location}.\n\nTip: Balas 'semula' untuk cari lokasi lain.`
  - en: `Sorry, no jobs within 50km of {location}.\n\nTip: Reply 'restart' to try a different location.`
  - zh: `抱歉，{location}50公里内没有工作。\n\n提示：回复"重新开始"尝试其他位置。`

### Technical Details

**Storing scored jobs in conversation state:**
- The `scoredJobs` array (job ID + distance pairs) is stored in `conversation_state` so we don't need to re-query the database when expanding radius. Only the ID and distance are stored (not full job objects) to keep the JSONB small.
- When expanding, we filter `scoredJobs` at the new radius, fetch full job details for matches, and present them.

**Expand search handler integration:**
- The handler for `expand_search_pending` will be checked in `handleMatchingUserConversational` (or its equivalent) before the normal job-number selection logic, so "ya"/"yes" is caught correctly.

**Radius tiers:** 10km -> 20km -> 50km (3 tiers, then final no-jobs message).

