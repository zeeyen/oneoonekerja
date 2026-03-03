

## Fix: "Ya" Not Expanding to 20km + Unrecognized Input Breaking Expand Flow

### What's Happening

The conversation flow breaks at two points:

1. Bot asks "expand to 20km? ya/tidak" but when user replies with something unexpected like "Banting ?", the bot loses track that it was waiting for a yes/no answer. Instead of re-asking, it resets everything and tells the user to say "cari kerja".

2. When user then says "cari kerja", the bot starts a fresh search at 10km (ignoring that 10km already failed), finds nothing again, and asks about 20km again -- creating a loop.

3. When user finally says "ya", the bot has already forgotten about the expand question and just says "Want to find a job? Say 'cari kerja'".

### The Fix (1 file)

**`supabase/functions/bot-processor/index.ts`**

Two changes in `handleMatchingConversational`:

**Change 1: Re-prompt on unrecognized input during expand question (~line 2923)**

When `expand_search_pending` is true and the user says something that isn't "ya" or "tidak", instead of falling through to the empty-jobs handler, re-ask the expand question clearly.

```
// Current: falls through silently, hits empty-jobs handler, resets state
// After: re-ask the yes/no question
if (convState.expand_search_pending) {
  ...
  if (isYes) { ... }
  else if (isNo) { ... }
  else {
    // Unrecognized reply -- gently re-ask
    const currentRadius = convState.current_radius || 10
    const nextRadius = currentRadius < 20 ? 20 : 50
    return { response: getText(lang, {
      ms: `Maaf, Kak Ani tak faham. Nak cari kerja dalam radius ${nextRadius}km?\n\nBalas 'ya' atau 'tidak'.`,
      en: `Sorry, I didn't understand. Search within ${nextRadius}km?\n\nReply 'yes' or 'no'.`,
      zh: `抱歉，我没听懂。要搜索${nextRadius}公里内的工作吗？\n\n回复"是"或"不是"。`
    }), updatedUser: user }
  }
}
```

**Change 2: Use remembered radius when "cari kerja" triggers a new search (~line 2935)**

In the empty-jobs handler where `detectJobSearchIntent` triggers a new search, check if there was a previous failed radius and start from the next tier (e.g., 20km) instead of always defaulting to 10km.

```
// Current: findAndPresentJobsConversational(user) -- always 10km
// After: use previous radius context if available
const lastRadius = convState.current_radius || convState.last_search_radius || 10
const searchRadius = lastRadius < 20 ? 20 : (lastRadius < 50 ? 50 : 10)
const searchResult = await findAndPresentJobsConversational(user, searchRadius)
```

### Result

- "Banting ?" during expand prompt: bot re-asks "ya atau tidak?" instead of breaking the flow
- "cari kerja" after a failed 10km search: searches at 20km directly instead of repeating 10km
- "ya" to expand question: works correctly because state is preserved

