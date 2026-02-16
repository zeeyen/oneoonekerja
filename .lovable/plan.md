

## Backfill `job_type` for Existing Jobs

This is a data-only update -- no code changes needed. We will run SQL UPDATE statements to set the `job_type` column for all 181 jobs using their `external_job_id` (JOB003 through JOB193).

### What will happen

A single SQL UPDATE using a VALUES list will match each `external_job_id` to its `job_type` from the CSV and update the `jobs` table. The two values are:

- **Freelance** -- ~120 jobs
- **Long Term** -- ~61 jobs

### SQL approach

```text
UPDATE jobs AS j
SET job_type = v.job_type
FROM (VALUES
  ('JOB003', 'Freelance'),
  ('JOB004', 'Freelance'),
  ('JOB005', 'Long Term'),
  ... (all 181 rows)
  ('JOB193', 'Freelance')
) AS v(external_job_id, job_type)
WHERE j.external_job_id = v.external_job_id;
```

### Scope

| Item | Detail |
|---|---|
| Records updated | ~181 jobs |
| Column affected | `job_type` (text, already exists) |
| Matching key | `external_job_id` |
| Code changes | None |
| Risk | Very low -- single column update, no schema change |

### Verification

After running the update, we will query the table to confirm all jobs have their `job_type` populated correctly.

