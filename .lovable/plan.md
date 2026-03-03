

# Kak Ani Bot: Conversation Intelligence Overhaul

## Analysis of Real Applicant Patterns

From ~500 conversation records across ~30+ real applicants, here are the critical failure patterns:

### Pattern 1: Rigid Fallback Loop (HIGH IMPACT — causes drop-offs)
When the bot enters `completed` state, it repeats the same robotic message regardless of what the user says:
```
User: "Petaling jaya ada"       → "Cakap 'cari kerja' untuk mula cari"
User: "Shah alam ada"           → "Cakap 'cari kerja' untuk mula cari"
User: "Ada hostel ke"           → "Cakap 'cari kerja' untuk mula cari"
User: "Jalan kebun shah alam"   → "Cakap 'cari kerja' untuk mula cari"
```
The user is clearly asking about jobs in specific locations, but the bot demands the exact phrase "cari kerja". This is the #1 cause of drop-offs.

### Pattern 2: Implicit Job Searches Not Recognized
Messages like these are clearly asking to search for jobs but get ignored:
- "Kak, ade kerja kat Muar?"
- "Ada kerja kat petaling Jaya?"
- "Masih ada ambil orang untuk kerjake"
- "Sy nak krj nilai negeri sembilan"
- "Ada kerja kat Kuala Lumpur"
- "Nak Cari Kerja kat seremban"

### Pattern 3: Job Selection Parsing Failures
The bot only accepts bare numbers. Real users type:
- "nombor 1" → NOT recognized
- "N0 3" (zero instead of O) → NOT recognized
- "Saya ingin mohon nombor 1 jika ada kekosongan" → NOT recognized
- "1-3" → parsed as "1" instead of asking for clarification
- "Nombor 1" → NOT recognized

### Pattern 4: Name Overwritten by Location
User "Najua" provided profile, then typed "Bandar baru nilai" for location. Bot overwrote name to "BANDAR BARU NILAI" and kept asking for location in a loop.

### Pattern 5: Language Lock Failures
- User says "cakap BM ngan aku la" or "BM pls" → bot continues responding in English
- User's language preference after onboarding isn't sticky — gets flipped by the mirroring system when they use loanwords like "part time"

### Pattern 6: Questions During Matching Ignored
- "Ni kilang apa" (What kind of factory is this?)
- "Ade krj normal ke" (Any normal shift jobs?)
- "Sy tak nak krj malam" (I don't want night shift)
- "Ad hostel akk" (Got hostel accommodation?)
- "Dia minta referral code" (Website is asking for referral code)
- "Lagi kilang ape ade" (What other factories are there?)

These are all natural questions that should be handled by GPT with job context, not thrown into rigid pattern matching.

---

## Root Cause: Pre-LLM Pattern Matching Steals Every Message

The current flow runs FOUR rigid pattern matchers BEFORE the LLM sees anything:

```text
Message arrives
  → detectJobSearchIntent()     ← steals "kerja", "job" keywords
  → interceptCommand()          ← steals numbers, greetings
  → extractJobNumber()          ← steals anything numeric  
  → isMoreCommand()             ← steals "lagi", "more"
  ↓ only leftovers reach NLU (understandMessage)
```

The fix is to invert this: **LLM-first, pattern-matching as fast-path only for unambiguous tokens**.

---

## Fix Plan

### 1. Enhance `completed.ts` — Make it LLM-Driven (Biggest Impact)

Currently the `completed` handler has a rigid gate: `detectJobSearchIntent()` runs first. If it returns false, and NLU doesn't classify as `question` or `job_preference`, the user gets the dead-end "Cakap 'cari kerja'" message.

**Change**: Remove the pre-NLU `detectJobSearchIntent` gate. Instead, enhance the NLU prompt for `completed` state to classify a richer set of intents:
- `job_search_with_location` — "ada kerja kat Muar?" → extract location + trigger search
- `job_search_generic` — "cari kerja", "nak kerja" → trigger search at current location
- `question_about_job` — "part time ke full time?" → answer using last_selected_job context
- `question_general` — "ada hostel?" → answer using GPT
- `follow_up_issue` — "dia minta referral code" → escalate or answer
- `greeting` / `other` → warm redirect with options

This means ANY natural phrasing triggers the right action without needing the exact keyword.

### 2. Enhance `matching.ts` — Better Job Selection & Questions

**Job selection parsing**: Expand `extractJobNumber()` in `jobs.ts` to handle:
- "nombor 1", "no 1", "num 1", "N0 3" (zero-for-O typo)
- "Saya nak nombor 1", "saya pilih 2"
- "1-3" → ask which specific number they want

**Question handling**: The matching NLU already handles questions, but the regex-based `relocationSearchIntent` check runs first and can misfire. Move location-based search detection into the NLU classification.

### 3. Fix Name Overwrite Bug in `onboarding.ts`

In the `collect_info` slot merge logic, when only location is missing, the `constrainExtractionToMissingSlot` function should prevent name overwrites. But the current implementation still allows GPT extraction to replace confirmed name with location text.

**Fix**: In `slots.ts` `mergeSlotValue`, add a stronger guard: if a slot has `source: 'confirmed'` or has been set more than once, require an explicit correction signal (e.g., "nama saya sebenarnya X") before allowing overwrite.

### 4. Improve Language Stickiness

- Detect explicit language switch requests: "BM pls", "cakap BM", "in Malay please" → immediately lock to BM
- Reduce sensitivity of per-turn mirroring: only switch language if 3+ strong signal words detected, not just 1 loanword like "part time"

### 5. Richer NLU Context for All States

Pass more state into the NLU prompt:
- In `completed`: include `last_selected_job` details so NLU can generate contextual answers in one call
- In `matching`: include the current page of jobs so NLU can answer "ni kilang apa?" with actual data
- In `collect_info`: include what's already collected so NLU understands context better

---

## Files Changed

| File | Change |
|------|--------|
| `completed.ts` | Remove `detectJobSearchIntent` gate, add LLM-driven routing with richer intents |
| `matching.ts` | Move relocation regex into NLU, improve question handling context |
| `jobs.ts` | Expand `extractJobNumber` to handle natural phrasing |
| `nlu.ts` | Add state-specific intent types, pass richer context (matched jobs, last job) |
| `gpt.ts` | Remove `detectJobSearchIntent` function (moved to NLU) |
| `slots.ts` | Strengthen name protection in `mergeSlotValue` |
| `helpers.ts` | Reduce language mirroring sensitivity, detect explicit language switch phrases |
| `commands.ts` | Add "BM pls", "cakap BM" as language switch commands |

### Deployment
- Redeploy `bot-processor` edge function after changes

