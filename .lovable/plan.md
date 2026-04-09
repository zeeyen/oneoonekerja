

## Pick Up Latest File from FTP Instead of Today's Date

### Problem
The scheduled job currently constructs a filename using today's date. Since files are uploaded at end of business day and picked up at 7am the next morning, we need to find the **latest** `Jobs_YYMMDD.csv` file in the `/production/` folder rather than guessing the date.

### Approach
When no `?date=` param is provided (i.e., the scheduled run), the function will:
1. Connect to FTP and list files in `/production/`
2. Filter filenames matching the pattern `Jobs_YYMMDD.csv`
3. Sort by the date portion descending
4. Download the most recent file

When `?date=` is provided (manual trigger), behavior stays the same — fetch that specific file.

### Changes

**`supabase/functions/ftp-import-jobs/index.ts`**

1. Add a new FTP helper `ftpListDirectory(remotePath)` that uses the `LIST` command in passive mode to get directory contents
2. Add a parser `findLatestJobsFile(listing)` that extracts `Jobs_YYMMDD.csv` filenames, parses dates, and returns the most recent one
3. Update the main handler: when no `?date=` param, call `ftpListDirectory("/production/")` then `findLatestJobsFile()` to determine which file to download, instead of constructing the filename from today's date

### Key Details
- The `LIST` FTP command returns a directory listing; we parse filenames with regex `/Jobs_(\d{6})\.csv/`
- Date comparison uses the `YYMMDD` string directly (lexicographic sort works for same-century dates)
- The manual trigger (`?date=YYMMDD`) bypasses directory listing entirely — no behavior change
- Response JSON will include the resolved `fileName` so admins can see which file was picked up

