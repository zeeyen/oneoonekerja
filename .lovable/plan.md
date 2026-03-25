

## Execute Bulk Import: 202 CSV Rows → Jobs Database

### Critical Issue to Fix
The current `useBulkImportJobs.ts` **skips** rows with `cancelled`/`completed` status (lines 279-282, 400-405). This means ~147 jobs that need their status updated to `completed`/`cancelled` would be ignored. The one-time script must process ALL rows regardless of status.

### Approach
Run a Python script via `psql` that:
1. Reads the uploaded CSV (202 rows)
2. Fetches existing jobs by `external_job_id` 
3. Fetches `malaysia_locations` for geocoding
4. For each row, applies the same transformations as `useBulkImportJobs.ts`:
   - Gender: `""` → `female`, `"1"` → `male`, `"2"` → `any`
   - Status: lowercase as-is (`open`, `active`, `completed`, `cancelled`)
   - Dates: already `YYYY-MM-DD`
   - Location resolution against `malaysia_locations`
5. **Updates** existing jobs (all changed fields including status, branch, job_type, location, url, salary, gender, ages)
6. **Inserts** new jobs
7. Outputs summary

### Expected Results

| Action | Count | Details |
|---|---|---|
| Updates | ~181 | Existing jobs get branch, status, job_type, and other field updates |
| Inserts | ~21 | New jobs added (gap job IDs not yet in DB) |
| Status → completed | ~140 | Hidden from bot |
| Status → cancelled | ~7 | Hidden from bot |
| Status → active/open | ~55 | Visible to applicants |

### Script Details
- Single Python script at `/tmp/import_jobs.py`
- Uses `psql` for DB access (env vars already set)
- Reuses same CSV parsing logic (handles quoted fields, multiline values)
- Processes ALL rows (no status-based skipping)
- Dry-run output first, then executes

### Files
| File | Change |
|---|---|
| `/tmp/import_jobs.py` | One-time import script (not part of codebase) |

