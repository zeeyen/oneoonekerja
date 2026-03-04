

## Problem: NLU contextualResponse replaces job display

When a user in `matching` state asks "ada kerja?", the NLU returns a vague contextualResponse like "ada beberapa kerja freelance yang boleh ALI lihat" — but the code uses this response as-is (line 307-308) without appending the actual job cards. The user never sees the jobs, asks again, gets the same vague answer.

## Fix: Append job listings to question responses in matching state

**File: `supabase/functions/bot-processor/matching.ts`**

In the `question` / `question_about_job` handler (lines 305-323), after generating the GPT response, **always append the current page of job listings** so the user can see and select jobs.

```
// Current (line 305-323):
if (matchNlu.messageType === 'question' || matchNlu.messageType === 'question_about_job') {
  let gptResp = matchNlu.contextualResponse || await generateKakAniResponse(...)
  // returns ONLY the text answer — no jobs shown
}

// After:
if (matchNlu.messageType === 'question' || matchNlu.messageType === 'question_about_job') {
  let gptResp = matchNlu.contextualResponse || await generateKakAniResponse(...)
  
  // Always append current job page so user can see & select
  const jobsDisplay = formatJobsMessage(matchedJobs, currentIndex, lang)
  gptResp = `${gptResp}\n\n${jobsDisplay}`
}
```

Same treatment for the `job_preference` handler (lines 326-342) and the default fallback (lines 345-361) — append job listings.

This ensures that no matter what the user asks while viewing jobs, they always see the actual job cards and can make a selection.

### Files Changed
| File | Change |
|------|--------|
| `matching.ts` | Append `formatJobsMessage()` output to question/preference/fallback responses |

