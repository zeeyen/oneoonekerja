## Completed: Update Bulk Import for New CSV Format

### Changes Made

1. **Database Migration** — Added `branch` (text) and `status` (text, default 'active') columns to `jobs` table.

2. **`src/types/database.ts`** — Added `branch` and `status` to `Job` interface.

3. **`src/hooks/useBulkImportJobs.ts`** — 
   - Header alias mapping supports both old and new CSV formats
   - New gender encoding: NULL/empty→female, 1→male, 2→any (backward compatible with old text values)
   - Status handling: Cancelled/Completed rows are skipped during import
   - Branch and status written on insert and update
   - ExistingJobData includes branch and status for change detection

4. **`src/components/BulkImportJobsModal.tsx`** — Added Branch and Job Status columns to preview table; skipped rows shown with orange badge.

5. **Bot Processor (`jobs.ts`, `shortcode.ts`)** — Added `.or('status.eq.open,status.eq.active,status.is.null')` filter so only open/active jobs (and legacy NULL status) are shown to applicants. Branch displayed in job messages.

### Reporting Impact
None — existing admin queries, stats, and reporting are unaffected (additive columns only).
