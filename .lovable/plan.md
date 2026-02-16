

## Update Bulk Import to Support New CSV Format

### What Changed in the CSV

The new CSV adds one column: **`job_type`** (position 4, between `job_title` and `company_name`). Values include `"Freelance"` and `"Long Term"`. Everything else is identical to the current format.

Other observations:
- `wages_per_day` uses `-` for empty values (already handled by existing code)
- `end_date` uses `YYYY-MM-DD` format (already supported)
- No other structural changes

### Changes Required

**1. Database Migration -- Add `job_type` column to `jobs` table**

Add a text column (not the old integer-based one) to store values like "Freelance", "Long Term", etc.

```sql
ALTER TABLE public.jobs ADD COLUMN job_type text;
```

**2. `src/hooks/useBulkImportJobs.ts`**

- Add `job_type: string` to `CsvRow` interface
- Add `'job_type'` to `CSV_HEADERS` array (after `job_title`)
- In `importRows`, include `job_type` in the insert record: map the CSV value to the DB column
- In `updateExistingRows`, optionally detect and update `job_type` changes for existing jobs
- In `detectLocationChanges`, consider adding `job_type` comparison (or rename the function to `detectChanges`)

**3. `src/types/database.ts`**

- Add `job_type: string | null` to the `Job` interface

**4. `src/components/BulkImportJobsModal.tsx`**

- No structural changes needed -- the table preview already shows title, company, location, etc.
- Optionally add a "Type" column to the preview table to show Freelance/Long Term

**5. Template download**

- The `generateCsvTemplate()` function will automatically include `job_type` since it uses `CSV_HEADERS`

### Summary

| File | Change |
|---|---|
| DB migration | Add `job_type text` column to `jobs` |
| `src/hooks/useBulkImportJobs.ts` | Add `job_type` to CsvRow, CSV_HEADERS, insert/update logic |
| `src/types/database.ts` | Add `job_type` to Job interface |
| `src/components/BulkImportJobsModal.tsx` | Optionally show job type in preview table |

This is a small, low-risk change -- just one new column flowing through the existing pipeline.

