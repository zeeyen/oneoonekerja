

## Remove Human Agent / Customer Service Flow from Bot Processor

### What exists today

The "human agent" flow is a simple keyword-detection-and-reply mechanism with **no state changes** -- it doesn't modify the user's onboarding step or conversation state. It consists of three isolated pieces:

1. **`CUSTOMER_SERVICE_MESSAGES` constant** (lines 406-431) -- Trilingual messages with a phone number and email directing users to contact support.

2. **`detectCustomerServiceIntent()` function** (lines 701-713) -- Checks if the user's message contains keywords like "agent", "human", "tolong", "complain", etc.

3. **Call site in the main handler** (lines 494-501) -- Early intercept in `processWithKakAni` that checks every incoming message and short-circuits with the CS message if detected.

There are also a few **passive references** to "customer service" in ban/violation messages (lines 98-111) that tell banned users to "contact customer service". These are just text strings, not functional flows.

### Dependencies and risks

- **No state dependencies**: The CS flow does not change `onboarding_step`, `conversation_state`, or any database records. Removing it won't break any downstream logic.
- **No other callers**: `detectCustomerServiceIntent` and `CUSTOMER_SERVICE_MESSAGES` are only used at the single call site (line 494).
- **Keyword overlap risk**: Words like "tolong" (help), "bantuan" (assistance), and "masalah" (problem) currently get intercepted by the CS detector **before** reaching the AI/onboarding logic. After removal, these words will flow through to Kak Ani's normal conversational handling, which is actually better UX -- Kak Ani can try to help directly instead of deflecting to a phone number.

### Changes to make

**File: `supabase/functions/bot-processor/index.ts`**

1. **Delete** the `CUSTOMER_SERVICE_MESSAGES` constant (lines 406-431)
2. **Delete** the `detectCustomerServiceIntent()` function (lines 701-713)
3. **Delete** the call site that checks for CS intent and returns early (lines 494-501)
4. **Update ban messages** (lines 98-111): Replace "contact customer service" / "hubungi khidmat pelanggan" with a generic note like "Sila hubungi kami di support@101kerja.com" or simply remove those lines, since there's no live agent to escalate to. This is optional -- the ban messages still make sense as general text.

### What happens after removal

- Messages containing "tolong", "bantuan", "agent", "help me", etc. will no longer be intercepted early. They will flow through to the normal bot logic (onboarding or matching), where Kak Ani's AI responses will handle them contextually.
- No functional flow is broken since the CS handler had no side effects.
- The file header comment mentioning "customer service" (line 5) should also be cleaned up.

### Summary

| Item | Lines | Action |
|------|-------|--------|
| `CUSTOMER_SERVICE_MESSAGES` | 406-431 | Delete |
| CS intent call site | 494-501 | Delete |
| `detectCustomerServiceIntent()` | 701-713 | Delete |
| Ban message text (optional) | 98-111 | Update wording |
| File header comment | 5 | Remove "customer service" mention |

Total: ~45 lines removed, zero risk of breaking any flow.
