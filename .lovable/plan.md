

## Fix: Add "Job ID" Header Alias

### Problem
The new CSV format uses the header **"Job ID"** (with a space). The alias map only has `'job_id'` (underscore). During parsing, headers are lowercased to `"job id"`, which has no match in `HEADER_ALIAS_MAP` — so `external_job_id` is never populated, breaking duplicate detection entirely.

### Fix
Add one line to `HEADER_ALIAS_MAP` in `src/hooks/useBulkImportJobs.ts`:

```
'job id': 'job_id',
```

Also add `'job type': 'job_type'` and `'end date': 'end_date'` since the new CSV likely uses spaces in those headers too.

### Files Changed

| File | Change |
|---|---|
| `src/hooks/useBulkImportJobs.ts` | Add `'job id': 'job_id'`, `'job type': 'job_type'`, `'end date': 'end_date'` to `HEADER_ALIAS_MAP` |

