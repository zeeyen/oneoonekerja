

## Plan: Update Bulk Import for New CSV Format

### Summary

Update the bulk import to handle the new CSV column names, add `branch` and `status` fields to the database, implement new gender encoding (NULL=female, 1=male, 2=any), and filter jobs by status in the bot. Existing admin reporting remains untouched.

---

### 1. Database Migration: Add `branch` and `status` columns to `jobs` table

```sql
ALTER TABLE public.jobs ADD COLUMN branch text;
ALTER TABLE public.jobs ADD COLUMN status text DEFAULT 'active';
```

Update `src/types/database.ts` `Job` interface to add `branch: string | null` and `status: string | null`.

---

### 2. Update `useBulkImportJobs.ts` — CSV Parser & Import Logic

**a) Header alias mapping** — Map new CSV headers to internal field names:
- `"company name"` → `company_name`
- `"reference no."` → ignored
- `"branch"` → `branch` (new)
- `"wages per month (rm)"` → ignored
- `"wages per day (rm)"` → ignored
- `"start date"` → ignored
- `"status"` → `status` (new)
- `"no. of required"`, `"applicants"`, `"no. of workers"`, `"team lead"` → ignored
- `"num. of shifts"`, `"branch manager"`, `"supervisor"` → ignored
- `"no."` → `id` (row number, mapped to existing `id` field)

Update `CsvRow` to include `branch` and `status`. Update `CSV_HEADERS` and `parseCsvContent` to use alias lookup so both old and new CSV formats work.

**b) New gender normalization:**
- Empty/NULL → `"female"`
- `"1"` → `"male"`
- `"2"` → `"any"`
- Keep backward compat: `"both"` → `"any"`, `"male"`/`"female"` pass through

**c) Status handling in `processRows()`:**
- Rows with status "Cancelled" or "Completed" get an error: `"Skipped: status is [status]"` so they won't be imported.

**d) Update `importRows()`** and `updateExistingRows()`:
- Write `branch` and `status` to the database on insert/update.

**e) Update `detectLocationChanges()`:**
- Also detect changes in `branch` and `status`.

**f) Update `ExistingJobData`** interface to include `branch` and `status`.

---

### 3. Update `BulkImportJobsModal.tsx`

- Add "Branch" and "Status" columns to the preview table.
- Show skipped cancelled/completed rows with a distinct badge/icon.

---

### 4. Bot Processor: Filter by Status

**`jobs.ts` (line 87-90):** Add `.in('status', ['open', 'active'])` to the job query in `findAndPresentJobsConversational`.

**`shortcode.ts` (line 88-91):** Add the same `.in('status', ['open', 'active'])` filter.

This ensures only Open/Active jobs are shown to applicants via the bot.

---

### 5. What Stays Unchanged (Reporting Safe)

- `useJobs.ts` (admin jobs list) — No changes needed. It already filters by `expire_by` date. The new `status` column is additive and won't affect existing queries.
- `JobDetailPage.tsx` — No breaking changes. The `branch` field can optionally be displayed here later.
- `useJobStats.ts`, `useJobMatchCounts` — Untouched, queries aggregate on `job_matches` not affected.
- CSV export functionality — Untouched, exports query existing columns.
- `ApplicantsPage`, `ConversationsPage`, `Dashboard` — No job schema dependencies.

---

### Files Changed

| File | Change |
|---|---|
| Migration SQL | Add `branch` and `status` columns to `jobs` |
| `src/types/database.ts` | Add `branch`, `status` to `Job` interface |
| `src/hooks/useBulkImportJobs.ts` | Header aliases, gender logic, status filtering, branch/status persistence |
| `src/components/BulkImportJobsModal.tsx` | Show branch & status in preview table |
| `supabase/functions/bot-processor/jobs.ts` | Filter by status in job query |
| `supabase/functions/bot-processor/shortcode.ts` | Filter by status in shortcode query |

