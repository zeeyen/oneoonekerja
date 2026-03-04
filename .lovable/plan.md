

## Graceful Escalation to Human — Current State & Plan

### Current State: No escalation exists

The bot has **zero** paths that offer the applicant a way to reach a human. The only place contact info appears is `support@101kerja.com` in the profanity ban messages — and that's for appeals, not general help.

### Exhaustive List of Situations Where Escalation Should Be Offered

Here are all the dead-end or frustration scenarios currently in the codebase:

| # | Situation | Current file & behavior | What happens now |
|---|-----------|------------------------|------------------|
| 1 | **No jobs at max radius (50km)** | `jobs.ts` line 190-197 | "Tiada kerja... balas 'semula'" — no human contact |
| 2 | **User declines radius expansion** | `matching.ts` line 83-96 | "Balas 'semula'" — dead end |
| 3 | **No jobs at all in DB** | `jobs.ts` line 114-122 | "Takde kerja... cuba check balik" — dead end |
| 4 | **No jobs in matching state (empty list)** | `matching.ts` line 146-160 | Resets to completed, says "cakap cari kerja" |
| 5 | **Shortcode returns no jobs** | `shortcode.ts` line 111-138 | "Tiada kerja dijumpai... balas semula" |
| 6 | **End of job list (all jobs viewed)** | `matching.ts` line 226-237 | "Dah habis senarai" — no escalation |
| 7 | **Confusion in completed state** | `completed.ts` line 178-193 | GPT response nudging "cari kerja" — no human option |
| 8 | **GPT API failure** | `gpt.ts` line 49-51 | "Ada masalah teknikal" — no contact info |
| 9 | **NLU API failure / 429 quota** | `nlu.ts` (fallback) | Falls back to safe default — no human option |
| 10 | **Bot processor top-level error** | `index.ts` catch block | "Ada masalah teknikal la adik" — no contact |
| 11 | **Repeated fallback responses** | `matching.ts` line 353-372, `completed.ts` line 195-217 | GPT tries to answer but user may still be stuck |
| 12 | **Session expired — user confused** | `session.ts` line 100-115 | If user doesn't reply 1/2 and no location detected, falls through to re-show menu |
| 13 | **Ban message** | `index.ts` line 67-72, `profanity.ts` line 82-97 | Shows `support@101kerja.com` — already has contact but wrong one |

### Proposed Implementation

**1. Create a shared escalation footer helper** in `helpers.ts`:

```typescript
export function getEscalationFooter(lang: string): string {
  return getText(lang, {
    ms: `\n\n💬 Perlukan bantuan? Hubungi kami:\n📱 WhatsApp: wa.me/60162066861\n📧 Email: info@101kerja.com`,
    en: `\n\nNeed help? Contact us:\n📱 WhatsApp: wa.me/60162066861\n📧 Email: info@101kerja.com`,
    zh: `\n\n需要帮助？联系我们：\n📱 WhatsApp: wa.me/60162066861\n📧 Email: info@101kerja.com`
  })
}
```

**2. Append the footer in these files/scenarios:**

| File | Scenario | Where to append |
|------|----------|-----------------|
| `jobs.ts` | No jobs at max radius (line 191) | After "tiada kerja" message |
| `jobs.ts` | No jobs in DB at all (line 117) | After "takde kerja" message |
| `matching.ts` | User declines expansion (line 91) | After "ok takpe" message |
| `matching.ts` | No jobs in state, no search intent (line 155) | After "tak ada kerja" message |
| `matching.ts` | End of job list (line 228) | After "dah habis senarai" message |
| `shortcode.ts` | Shortcode no results (line 118, 126) | After "tiada kerja dijumpai" message |
| `completed.ts` | Confusion handler (line 180) | After confusion response |
| `gpt.ts` | API error fallback (line 51) | After "masalah teknikal" message |
| `index.ts` | Top-level catch (line ~last) | After "masalah teknikal" message |
| `profanity.ts` | Ban messages (line 84, 94) | Update `support@101kerja.com` → `info@101kerja.com` + WhatsApp |

**3. Update `config.ts`** — add contact constants so they're easy to change:

```typescript
export const SUPPORT_WHATSAPP = '60162066861'
export const SUPPORT_EMAIL = 'info@101kerja.com'
```

### Files Changed

| File | Change |
|------|--------|
| `config.ts` | Add contact constants |
| `helpers.ts` | Add `getEscalationFooter()` helper |
| `jobs.ts` | Append footer to no-jobs scenarios |
| `matching.ts` | Append footer to dead-end scenarios |
| `shortcode.ts` | Append footer to no-results |
| `completed.ts` | Append footer to confusion handler |
| `gpt.ts` | Append footer to API error fallback |
| `index.ts` | Append footer to top-level error catch |
| `profanity.ts` | Update ban contact info |

