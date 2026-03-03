

## Problem Analysis

Two bugs causing the bot to mishandle "Kerja nie part time atau full time?":

### Bug 1: `detectJobSearchIntent` is too broad
In `gpt.ts` line 62, the function matches on individual words like `'kerja'`, `'job'`. So "Kerja nie part time atau full time?" triggers a new job search because it contains "kerja". This check runs BEFORE NLU classification in `completed.ts` (line 28-52), so the question never reaches the GPT-powered intent classifier.

### Bug 2: No job context after selection
When a user selects a job in `matching.ts` (line 186-190), `conversation_state` is cleared to `{}` and status set to `completed`. The next message hits `completed.ts`, which has zero context about the previously selected job to answer questions about it.

---

## Fix Plan

### 1. Fix `detectJobSearchIntent` in `gpt.ts`
Make it require stronger signals — not just a single keyword like "kerja". Rules:
- Require an **action word** (`cari`, `find`, `search`) OR a **compound phrase** (`cari kerja`, `nak kerja`, `find job`)
- Exclude messages that are clearly **questions** (contain `?`, or start with question words like `apa`, `bila`, `berapa`, `adakah`, `is`, `what`, `how`)
- Single word "kerja" in a sentence should NOT trigger search

### 2. Preserve last selected job in `conversation_state` after selection
In `matching.ts`, when a job is selected (around line 186-190), instead of clearing `conversation_state` to `{}`, keep a `last_selected_job` reference:
```
conversation_state: { last_selected_job: { title, company, location, salary, job_type, url } }
```

### 3. Pass job context to GPT in `completed.ts` question handler
In the `question` branch (line 100-117), check if `convState.last_selected_job` exists and include it in the GPT context prompt so Kak Ani can answer questions like "is it full time?" with actual job data.

### Files Changed
- `supabase/functions/bot-processor/gpt.ts` — Tighten `detectJobSearchIntent`
- `supabase/functions/bot-processor/matching.ts` — Preserve `last_selected_job` in state after selection
- `supabase/functions/bot-processor/completed.ts` — Include last selected job context when answering questions
- Redeploy edge function

