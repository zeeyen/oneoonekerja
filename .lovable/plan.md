

## Set Up pg_cron Schedule for Daily FTP Import

### What
Register a cron job in Supabase that calls the `ftp-import-jobs` Edge Function every day at 7:00 AM MYT (23:00 UTC).

### How
Run the following SQL using the Supabase SQL insert tool (not a migration, since it contains project-specific URLs and keys):

```sql
SELECT cron.schedule(
  'daily-ftp-import',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url:='https://gbvegikhzqxdxpldfdls.supabase.co/functions/v1/ftp-import-jobs',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdidmVnaWtoenF4ZHhwbGRmZGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NTU4MDIsImV4cCI6MjA4NTMzMTgwMn0.cnLYEJCYFH4NjMyarYziqkG9mN99KfeSvSlsZRJ96sE"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);
```

### Details
- **Schedule**: `0 23 * * *` = 23:00 UTC = 7:00 AM MYT (UTC+8)
- **No date param**: The function will automatically list the FTP `/production/` folder and pick up the latest `Jobs_YYMMDD.csv` file
- Uses the anon key for authorization (the Edge Function doesn't require service role access for this endpoint)
- After setup, verify with `SELECT * FROM cron.job;` to confirm registration

