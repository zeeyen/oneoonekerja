

## Problem: NLU is Silently Failing — All Messages Get Default Response

### Evidence from Logs

Every single NLU call returns the exact same SAFE_DEFAULT output:
```
🧠 NLU: data_response (0.5), fields=[], extract=true, lang=null
```

This happens for ALL messages — profile data, job questions, everything. The NLU GPT call is systematically failing but the error is swallowed. The `🧠 NLU:` log appears (not the `⚠️ NLU fallback:` log), meaning JSON parsing "succeeds" — likely on an empty `{}` or error response body.

When NLU returns `data_response` in `completed.ts`, there is no handler for it, so the code falls through to the generic greeting redirect at line 196 — the robotic "Kak Ani boleh tolong carikan kerja" message.

### Root Causes

1. **No NLU debug logging**: The raw GPT response is never logged, making failures invisible
2. **`completed.ts` has no fallback for unrecognized intents**: Any messageType that isn't explicitly handled (including the default `data_response`) falls to the rigid redirect instead of using GPT to respond naturally

### Fix Plan

**1. Add diagnostic logging to `nlu.ts`**
Log the raw GPT response content before JSON parsing so we can see exactly what OpenAI returns:
```
console.log(`🧠 NLU raw response: ${content.substring(0, 200)}`)
```
Also log the HTTP status code from the OpenAI API response.

**2. Make `completed.ts` resilient to NLU failures**
Replace the final greeting/other fallback (line 195-202) with a GPT-powered response that uses `lastSelectedJob` context. Instead of the rigid redirect message, call `generateKakAniResponse` with full context so the bot can naturally answer any message — even if NLU classification fails.

This means the code becomes:
- If NLU classifies correctly → handle the specific intent
- If NLU fails or returns unknown type → still give a natural GPT response using all available context (last selected job, user profile, recent messages)

**3. Same resilience in `matching.ts` fallback**
The matching fallback at line 346-350 is also rigid. Replace with a GPT-powered response including current job list context.

### Files Changed
| File | Change |
|------|--------|
| `nlu.ts` | Add raw response logging + HTTP status logging |
| `completed.ts` | Replace rigid fallback with GPT-powered contextual response |
| `matching.ts` | Replace rigid fallback with GPT-powered contextual response |
| Redeploy edge function |

