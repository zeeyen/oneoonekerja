

## FTP Bulk Import: Scheduled + Manual

### Summary
Create a Supabase Edge Function that fetches a CSV from the FTP server, parses it, and upserts jobs into the database. Expose it for both scheduled (daily 7am) and manual (button click) execution.

### Architecture

```text
┌─────────────┐     ┌──────────────────────┐     ┌──────────┐
│ FTP Server   │────→│ Edge Function         │────→│ Jobs DB  │
│ (bynryfoundry)│     │ ftp-import-jobs       │     │          │
└─────────────┘     └──────────────────────┘     └──────────┘
                         ↑            ↑
                    pg_cron 7am    Manual button
                                  (Jobs page)
```

### Secrets to Store
- `FTP_HOST` = `ftp.bynryfoundry.com`
- `FTP_USER` = `u811820295.bynry001`
- `FTP_PASS` = `I01kerja#2026`

These will be stored as Supabase Edge Function secrets (not in codebase).

### Edge Function: `ftp-import-jobs`

**Logic:**
1. Accept optional `?date=YYMMDD` query param (defaults to today's date)
2. Connect to FTP via `basic-ftp` (npm) or raw FTP commands over TCP using Deno
3. Download `/production/Jobs_YYMMDD.csv` into memory
4. Parse CSV rows with same field mapping as `useBulkImportJobs.ts`
5. Fetch existing jobs by `external_job_id` from DB
6. Fetch `malaysia_locations` for geocoding
7. For each row: validate, normalize gender/status, resolve location, then upsert (update existing, insert new) — processes ALL statuses including cancelled/completed
8. Return JSON summary: `{ inserted, updated, skipped, errors, date }`

**Date format:** Filename uses `YYMMDD` (e.g., `Jobs_260408.csv` = 2026-04-08)

### Scheduled Execution (pg_cron)

Set up a cron job to call the edge function daily at 7:00 AM MYT (UTC+8 = 23:00 UTC previous day):

```sql
SELECT cron.schedule(
  'daily-ftp-import',
  '0 23 * * *',  -- 7am MYT = 11pm UTC
  $$ SELECT net.http_post(...) $$
);
```

### UI: Manual Trigger Button

Add an "FTP Import" button next to the existing "Bulk Import" button on the Jobs page. Clicking it:
1. Opens a small dialog with a date picker (defaults to today)
2. Calls the edge function with the selected date
3. Shows progress/results (inserted, updated, errors)

### Files to Create/Modify

| File | Change |
|---|---|
| `supabase/functions/ftp-import-jobs/index.ts` | New edge function: FTP fetch + CSV parse + DB upsert |
| `src/components/FtpImportModal.tsx` | New modal: date picker + trigger + results display |
| `src/pages/JobsPage.tsx` | Add "FTP Import" button opening the modal |
| SQL (via insert tool) | pg_cron schedule for daily 7am MYT execution |

### Key Design Decisions
- FTP library: Use Deno's built-in TCP (`Deno.connect`) with raw FTP protocol commands (no npm dependency needed)
- The edge function replicates the same normalization logic (gender mapping, status handling, location resolution) from the existing bulk import
- Unlike the UI bulk import, this processes ALL rows regardless of status (same as the one-time Python script)
- The manual trigger lets admins pick any date to re-process a specific day's file

