

## Plan: One-Time CSV Import to Jobs Database

### Current State
- **181 jobs** exist in the database, all with `status='active'` and `branch=NULL`
- The CSV has **202 rows** (JOB003 through JOB205)
- All 181 existing jobs will match by `external_job_id` and need updates (branch + status)
- Roughly 21 rows are new jobs (JOB182-JOB205 range, minus any already imported)

### What Will Happen

| Category | Count (approx) | Action |
|---|---|---|
| **Existing → Update** | ~181 | Update `branch`, `status`, and any changed location/URL fields |
| **New → Insert** | ~21 | Insert with all mapped fields |
| **Cancelled/Completed** | ~80-100 | Status updated to `cancelled`/`completed` in DB (bot will stop showing them) |
| **Open/Active** | ~100-120 | Status set to `open`/`active`, remain visible to applicants |

### Key Data Transformations (per implemented rules)

1. **Gender**: `""` → `female`, `"1"` → `male`, `"2"` → `any`
2. **Status**: Stored as-is (lowercase). Cancelled/Completed jobs are **still imported** but marked with that status so the bot filters them out
3. **Branch**: New field populated from CSV (e.g., "Kilang Kereta Segambut", "Courier - Kota Kinabalu")
4. **Dates**: Already in `YYYY-MM-DD` format, maps to `expire_by`
5. **Ignored columns**: Company ID, Reference No., Wages, Start Date, No. of Required, Applicants, Workers, Team Lead, Shifts, Branch Manager, Supervisor

### Approach

Write a one-time Node.js script that:
1. Reads the uploaded CSV using the same `parseCsvContent` logic
2. Fetches existing jobs from DB by `external_job_id`
3. Fetches `malaysia_locations` for geocoding
4. For each row: resolves location locally, applies gender/status normalization
5. **Updates** existing jobs (branch, status, location changes)
6. **Inserts** new jobs
7. Outputs a summary of what was done

The script reuses the same field mapping, gender encoding, and status logic already implemented in `useBulkImportJobs.ts`.

### Before Executing — Preview Summary

Before running, the script will output a dry-run summary showing:
- How many rows will be inserted vs updated
- Which jobs change status (e.g., `active` → `completed`)
- Which jobs get a new branch value
- Any rows with validation errors

### Risk Assessment
- **No existing data deleted** — only inserts and updates
- **Reporting unaffected** — admin queries don't filter by status/branch
- **Bot impact** — Cancelled/Completed jobs will stop appearing to applicants (intended behavior)

### Files
| File | Change |
|---|---|
| Script (one-time, `/tmp/`) | Parse CSV, dry-run preview, then execute import |

