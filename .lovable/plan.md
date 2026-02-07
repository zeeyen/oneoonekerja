

## Add New Columns to Jobs Table and Enhance Location Resolution

### Overview
Add four new columns (`external_job_id`, `location_address`, `postcode`, `country`) to the `jobs` table, and enhance the bulk import geocoding logic to use the `location` and `postcode` fields as additional inputs when resolving latitude/longitude.

### Database Migration

Add four columns to the `jobs` table:

```sql
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS external_job_id TEXT,
  ADD COLUMN IF NOT EXISTS location_address TEXT,
  ADD COLUMN IF NOT EXISTS postcode TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Malaysia';
```

- `external_job_id` -- stores the source system's job ID (e.g. "JOB003")
- `location_address` -- stores the full location string from the CSV (e.g. "PORT KLANG, ")
- `postcode` -- five-digit postal code
- `country` -- defaults to "Malaysia"

### Enhanced Location Resolution

Currently, lat/lng is resolved by matching `city` against `malaysia_locations.name`. The enhancement adds two fallback strategies:

1. **Primary match** (existing): Match `city` against `malaysia_locations.name` within the same `state` (case-insensitive)
2. **Fallback 1 -- location field**: If city match fails, try matching the `location` field (cleaned, trimmed) against `malaysia_locations.name`
3. **Fallback 2 -- aliases**: Try matching `city` or `location` against `malaysia_locations.aliases` array

This cascading approach maximizes the geocoding hit rate.

### Files to Change

**Database migration** (1 migration):
- Add `external_job_id`, `location_address`, `postcode`, `country` columns to `jobs` table

**`src/types/database.ts`**:
- Add `external_job_id`, `location_address`, `postcode`, `country` fields to the `Job` interface

**`src/hooks/useBulkImportJobs.ts`**:
- Update `MalaysiaLocation` interface to include `aliases`
- Fetch `aliases` column alongside existing location data
- Update `resolveLocation` function to accept `location` as additional input and try alias matching
- Map `job_id` to `external_job_id`, `location` to `location_address`, `postcode` and `country` in the insert records

**`src/hooks/useBulkImportJobs.ts` -- resolveLocation enhanced logic**:
```
1. Try city vs malaysia_locations.name (within state) -- existing
2. Try location field vs malaysia_locations.name (within state)
3. Try city or location vs malaysia_locations.aliases
4. If all fail, return null (lat/lng will be empty)
```

**`src/components/JobEditForm.tsx`**:
- Add `postcode` and `location_address` input fields to the edit form
- Add these to the `JobEditFormData` interface

**`src/pages/JobDetailPage.tsx`**:
- Display `postcode`, `location_address`, and `external_job_id` in the job detail view
- Include `postcode` and `location_address` in the save/update payload

**`src/hooks/useJobForm.ts`**:
- Add `postcode`, `location_address`, `country` to `JobFormData` interface and defaults

