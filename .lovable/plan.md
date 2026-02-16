

## Add `job_type` to Bot's Job Knowledge

When applicants ask "Is this freelance?", "Part time ke?", or "这是全职吗？", the bot currently can't answer because `job_type` is not included in the job data passed to the AI. This plan fixes that.

### Changes (1 file)

**`supabase/functions/bot-processor/index.ts`**

1. **Add `job_type` to `MatchedJob` interface** (~line 242)
   - Add `job_type?: string` field

2. **Include `job_type` in job mapping** (~line 3291-3302)
   - When building `topJobs` from query results, include `job_type: s.job.job_type`

3. **Include `job_type` in the question-answering context** (~line 3019-3023)
   - Update the `jobsSummary` string to include job type info
   - Change from: `{title} at {company} ({location})`
   - Change to: `{title} at {company} ({location}, Type: {job_type || 'Not specified'})`

4. **Include `job_type` in the formatted job card** (~line 3373-3384)
   - Add a line showing job type (e.g., "Jenis: Freelance") in the job listing message so users can see it upfront

### What this enables

- When a user asks "Is job 1 freelance?", GPT will have the `job_type` data in its context and can answer accurately
- Job cards displayed to users will show the type (Freelance / Long Term) so they know before asking
- Works in all 3 languages (BM, EN, ZH)

### Technical detail

The `select('*')` query already fetches `job_type` from the database. The data just needs to be carried through to the `MatchedJob` objects and included in the GPT context string.
