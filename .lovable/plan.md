

## Enhance Completed-State Question Handling and Add Follow-Up Escalation

### Problem

When users who have completed onboarding (chosen a job) ask employment questions:

1. The `completed` state `question` handler (line 2815) calls GPT but provides **no job context** — no matched jobs, no selected jobs, no salary/location data. GPT has nothing to answer from.
2. If intent is classified as `other` (which happens when questions don't look like typical "questions"), the bot falls through to a rigid "say cari kerja" response (line 2828).
3. There's no escalation path for questions the bot genuinely can't answer.

### Solution

Two changes to the bot-processor, plus a new `follow_up` status with dashboard support.

---

### Part 1: Enrich the `completed` State Question Handler

**File: `supabase/functions/bot-processor/index.ts`**

**A. Fetch job context before answering (line ~2815)**

When a completed user asks a question, fetch their recent job selections and matched jobs to give GPT real data:

```
// Fetch user's selected jobs for context
const selections = await getUserJobSelections(user.id, 5)
const matchedJobs = convState.matched_jobs || []

// Build rich context with actual job data
const jobContext = selections.length > 0
  ? selections.map(s => `- ${s.job_title} at ${s.company || 'N/A'}, ${s.location_city || ''} ${s.location_state || ''}, URL: ${s.apply_url || 'N/A'}`).join('\n')
  : matchedJobs.slice(0, 5).map(j => `- ${j.title} at ${j.company}, ${j.location_city}`).join('\n')
```

Update the GPT context to include this data and instruct it to answer employment questions (salary, job type, location, requirements, working hours, etc.) using whatever job data is available. Instruct GPT to respond as an employment agency staff member.

**B. Add structured response with confidence check**

Use Option B (single call with structured JSON) to detect when GPT cannot answer:

```
Return JSON: {"answer": "...", "can_answer": true/false}
- can_answer = true: You have enough info to answer meaningfully
- can_answer = false: The question is about something not in the provided data
```

When `can_answer` is false, the bot apologizes and offers human follow-up.

**C. Broaden intent classification to catch more questions**

Update the `classifyIntent` prompt (line ~387) to add clarity:

- `question` should also include employment-related queries like "berapa gaji?", "full time ke part time?", "kerja ni macam mana?", even if they don't look like formal questions.
- Messages classified as `other` that contain question-like patterns should be re-evaluated.

**D. Soften the fallback (line 2828)**

Change the `completed` fallback from a rigid "say cari kerja" to also pass through GPT with employment context, so even `other`/`greeting` intents get a helpful response. Only truly unrelated messages get the "cari kerja" prompt.

---

### Part 2: Follow-Up Escalation Flow

**File: `supabase/functions/bot-processor/index.ts`**

When the bot determines it cannot answer (`can_answer: false`):

1. Send an apology + offer: "I don't have that specific information. Would you like someone from our team to contact you about this?"
2. Set `conversation_state.follow_up_offered = true` and `follow_up_question = <their question>`
3. On next message, check for `follow_up_offered` early in `processWithKakAni` (before the status switch at line ~1300):
   - If user says yes: set `onboarding_status = 'follow_up'`, confirm, clear flag
   - If user says no: clear flag, return to normal flow

---

### Part 3: Database Migration

Add `follow_up` to the onboarding_status CHECK constraint:

```sql
ALTER TABLE public.applicants
  DROP CONSTRAINT IF EXISTS users_onboarding_status_check;

ALTER TABLE public.applicants
  ADD CONSTRAINT users_onboarding_status_check
  CHECK (onboarding_status IN ('new', 'in_progress', 'completed', 'matching', 'follow_up'));
```

---

### Part 4: Dashboard Changes

**`src/types/database.ts`** -- Add `'follow_up'` to `onboarding_status` union type.

**`src/lib/applicantStatusConfig.ts`** -- Add follow_up config:
- Label: "Follow-Up"
- Style: `bg-orange-100 text-orange-800 border-orange-200`

**`src/hooks/useApplicants.ts`** -- Add `'follow_up'` to `ApplicantFilter` and filter switch case.

**`src/hooks/useApplicantFunnelCounts.ts`** -- Add `follow_up` count query.

**`src/components/ApplicantFunnel.tsx`** -- Add Follow-Up card to the funnel (orange, with PhoneForwarded icon), update grid to 7 columns.

---

### How It All Fits Together

```text
User (completed) sends: "kerja ni full time ke part time?"
                              |
                    classifyIntent -> "question"
                              |
              Fetch job selections + matched jobs
                              |
              GPT answers with job context as employment agency staff
              Returns: {"answer": "...", "can_answer": true}
                              |
                     Bot sends helpful answer
                     
---

User sends: "ada EPF tak?"
                              |
              GPT has no EPF data in context
              Returns: {"answer": "...", "can_answer": false}
                              |
              Bot: "Maaf, Kak Ani tak ada info tu. Nak Kak Ani
                    minta team kami hubungi adik?"
              Sets: follow_up_offered = true
                              |
User replies: "ya" -> onboarding_status = 'follow_up'
                       Dashboard shows orange "Follow-Up" badge
```

### Files Changed

| File | Change |
|---|---|
| DB migration | Add `follow_up` to CHECK constraint |
| `supabase/functions/bot-processor/index.ts` | Enrich question context, add confidence check, follow-up flow, soften fallback |
| `src/types/database.ts` | Add `follow_up` to type |
| `src/lib/applicantStatusConfig.ts` | Add follow_up config |
| `src/hooks/useApplicants.ts` | Add `follow_up` filter |
| `src/hooks/useApplicantFunnelCounts.ts` | Add follow_up count |
| `src/components/ApplicantFunnel.tsx` | Add Follow-Up funnel card |

