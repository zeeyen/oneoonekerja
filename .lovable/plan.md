
## Plan: Add Conversational Intelligence to Bot-Processor

### Problem Summary

The bot uses GPT only for structured data extraction (name/age/gender/location) but never for understanding what the user is saying. When users ask questions, express preferences, or speak naturally, the bot ignores context and repeats scripted prompts. This affects roughly half of all applicants.

### Solution: Add an Intent Detection + Contextual Response Layer

The fix introduces a "conversational awareness" layer that intercepts messages **before** they hit the rigid state machine handlers. This layer uses GPT to understand what the user actually wants and responds appropriately, while still advancing the onboarding flow when possible.

### Architecture Change

```text
CURRENT FLOW:
  User Message --> State Switch --> extractAllInfo (JSON only) --> Script Response

NEW FLOW:
  User Message --> Intent Classifier --> Route:
    a) Structured data? --> extractAllInfo (existing) --> continue flow
    b) Question about jobs? --> GPT contextual answer + nudge back to flow
    c) Confusion/frustration? --> GPT empathetic response + simplified guidance
    d) Off-topic? --> GPT gentle redirect
```

### Changes to `supabase/functions/bot-processor/index.ts`

**1. Add an `classifyIntent` function (~30 lines)**

A lightweight GPT call that classifies the user's message into categories:
- `data_response` -- user is providing name/age/gender/location as requested
- `question` -- user is asking something (about jobs, process, etc.)
- `confusion` -- user is confused or frustrated
- `job_preference` -- user is expressing what kind of work they want
- `greeting` -- casual greeting or acknowledgment

This uses GPT-4o-mini with a short system prompt, temperature 0, and max_tokens 50. Cost: minimal (under 100 tokens per call).

**2. Modify `handleOnboardingConversational` (collect_info step)**

Before calling `extractAllInfo`, run `classifyIntent`. If the intent is NOT `data_response`:

- For `question`: Call `generateKakAniResponse` with context about what info is still needed, let GPT answer the question naturally, then gently remind them what's needed.
- For `confusion`: Provide a simpler, more empathetic version of the info request (e.g., "Takpe, satu-satu ye. Nama adik apa?" instead of the full 4-field template).
- For `job_preference`: Acknowledge the preference ("Ok, adik minat warehouse ye!"), store it, then continue collecting missing info.
- For `greeting`: Respond warmly, then re-ask for missing info naturally.

If intent IS `data_response`, proceed with existing `extractAllInfo` logic unchanged.

**3. Modify `handleMatchingConversational` (matching state)**

Currently, any input that isn't a number or "lagi" gets a scripted "Reply with a number" response. Change:

- Before the "invalid input" fallback (line 2836), add intent classification.
- If user is asking about a specific job ("gudang apa tu?"), use GPT to answer using the matched_jobs data in conversation state.
- If user is expressing preference ("nak yang dekat dengan jalan kebun"), filter/re-sort the existing matched_jobs and present relevant ones.
- If user provides a new location while in matching state, detect it and trigger a new search (currently this is ignored).

**4. Modify `handleCompletedUserConversational` (completed state)**

Currently only detects "cari kerja" keywords. Change:

- If user mentions a specific location + job type (like "kerja kat jalan kebun shah alam sebagai warehouse operator"), extract the location, update it, and search -- don't just say "say 'cari kerja'".
- Use `classifyIntent` to detect implicit job search intent beyond keyword matching.

**5. Enhance `generateKakAniResponse` to include conversation context**

Currently sends only the user's message + a context instruction. Enhance to include:
- The user's current onboarding state and what info is missing
- The last 2-3 conversation turns (from conversation_state or a small buffer)
- What jobs are currently being shown (if in matching state)

This gives GPT enough context to respond meaningfully instead of generically.

**6. Add conversation history buffer to `conversation_state`**

Store the last 3 message pairs (user + bot) in `conversation_state.recent_messages`. This is a lightweight array that gets trimmed each turn. This allows GPT to understand multi-turn context without querying the conversations table.

### What Does NOT Change

- The core state machine flow (new -> in_progress -> matching -> completed) stays the same
- `extractAllInfo` extraction logic stays the same -- it's good at what it does
- Job matching, shortcode handling, location geocoding -- all unchanged
- Profanity filter, ban system, session timeout -- all unchanged
- The onboarding still collects name/age/gender/location -- the change is HOW it handles non-standard input

### Expected Impact

- Users who ask questions mid-flow will get contextual answers instead of script repetition
- Users who express job preferences will have those acknowledged
- Frustrated users will get empathetic responses
- Natural language speakers will feel like they're talking to a human, not a form
- Additional GPT cost: ~100 tokens per non-standard message (negligible at current volume)

### Technical Details

**New function: `classifyIntent`**

```text
Input: message (string), currentStep (string), lang (string)
Output: { intent: string, confidence: number }

GPT prompt (system): "Classify the user's intent. They are currently in step '{step}' 
of a job-finding chatbot. Return JSON: {intent, confidence}.
Intents: data_response, question, confusion, job_preference, greeting, other"

Model: gpt-4o-mini, temperature: 0, max_tokens: 50
```

**Conversation history buffer structure:**

```text
conversation_state.recent_messages = [
  { role: "bot", content: "Boleh bagitahu nama..." },
  { role: "user", content: "Boleh tahu gudang apa tu?" }
]
// Max 6 entries (3 turns), FIFO
```

**Modified `generateKakAniResponse` signature:**

```text
Before: generateKakAniResponse(user, message, contextInstruction)
After:  generateKakAniResponse(user, message, contextInstruction, recentMessages?)
```

The `recentMessages` array gets injected into the GPT messages array before the user's current message, giving GPT conversational context.

### Files Changed

Only one file: `supabase/functions/bot-processor/index.ts`

- Add `classifyIntent` function (~30 lines)
- Modify `handleOnboardingConversational` collect_info case (~40 lines changed)
- Modify `handleMatchingConversational` fallback section (~20 lines changed)
- Modify `handleCompletedUserConversational` (~15 lines changed)
- Enhance `generateKakAniResponse` (~10 lines changed)
- Add conversation history tracking (~15 lines across handler functions)

Total: ~130 lines of new/modified code in a single file.
