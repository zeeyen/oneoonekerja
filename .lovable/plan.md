

## Add `external_job_id` to Job Displays in Bot Messages

### Overview
Append the `external_job_id` (e.g., "JOB144") to job titles wherever they appear in WhatsApp bot replies, so users see titles like **"General Worker - Warehouse Yong Peng (JOB144)"** instead of just **"General Worker - Warehouse Yong Peng"**.

### Changes

**1. Update `MatchedJob` interface (line ~242)**
Add `external_job_id?: string` to the interface so the field is carried through conversation state.

**2. Include `external_job_id` when mapping jobs (line ~2463)**
Where `topJobs` are built from query results, add `external_job_id: s.job.external_job_id` to the mapped object. Since the query already uses `select('*')`, the field is already fetched from the database.

**3. Update `formatJobsMessage` function (line ~2533)**
Change the job title line from:
```
*1. General Worker - Warehouse Yong Peng*
```
to:
```
*1. General Worker - Warehouse Yong Peng (JOB144)*
```
By building a display title: `const displayTitle = job.external_job_id ? \`\${job.title} (\${job.external_job_id})\` : job.title`

**4. Update job selection confirmation message (line ~2199)**
Same pattern for the "Best! Adik pilih:" / "Great choice!" / confirmation messages -- use `displayTitle` with the external_job_id appended.

### Technical Details
- The `external_job_id` field already exists in the `jobs` table and is fetched via `select('*')`.
- The `MatchedJob` objects are stored in `conversation_state` (JSONB), so the new field will persist across paginated views.
- If `external_job_id` is null/empty, the title displays as before (no parenthetical).
- Redeploy `bot-processor` after changes.

