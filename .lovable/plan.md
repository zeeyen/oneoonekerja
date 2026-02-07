

## Bulk Update Jobs via CSV Import

### Overview
Add a CSV bulk import feature to the Jobs page that lets admins upload a CSV file to create or update jobs in bulk. During import, the system will automatically resolve `latitude` and `longitude` from the `location_city` and `location_state` fields using the existing `malaysia_locations` lookup table (427 pre-geocoded cities).

### User Flow
1. Admin clicks "Bulk Import" button on the Jobs page header
2. A modal dialog opens with:
   - A "Download Template" button to get a sample CSV with correct headers
   - A file upload area for the CSV
3. After uploading, the system parses the CSV and shows a preview table with validation status per row
4. Rows with unresolved locations are flagged with a warning (import still allowed, just no lat/lng)
5. Admin clicks "Import" to upsert all valid rows into the database
6. A summary toast shows how many rows were created/updated and how many had location warnings

### Technical Details

**New files:**
- `src/components/BulkImportJobsModal.tsx` -- Modal with file upload, CSV parsing, preview table, and import logic
- `src/hooks/useBulkImportJobs.ts` -- Hook containing CSV parsing, location resolution, and upsert mutation

**Modified files:**
- `src/pages/JobsPage.tsx` -- Add "Bulk Import" button next to the page header

**CSV Template Columns:**
```text
title, company, industry, location_city, location_state, salary_range, gender_requirement, min_age, max_age, min_experience_years, expire_by, url
```

**Location Resolution Logic (client-side):**
1. Fetch all rows from `malaysia_locations` table once when the modal opens
2. For each CSV row, match `location_city` against `malaysia_locations.name` (case-insensitive) within the matching `state`
3. If found, populate `latitude` and `longitude` from the lookup
4. If not found, flag the row with a warning but still allow import (lat/lng will be null)

**Database Upsert:**
- Use Supabase `.upsert()` with no conflict key (all rows are inserts as new jobs)
- Or if a job `title + company + location_state` combination already exists, update it (optional -- default is insert-only)
- Each row sets `last_edited_at = now()` and `last_edited_by = current user id`
- Batch upsert in chunks of 50 rows to avoid hitting request size limits

**Validation per row:**
- `title` is required
- `expire_by` must be a valid date (YYYY-MM-DD)
- `gender_requirement` must be one of: `any`, `male`, `female` (defaults to `any`)
- `min_age`/`max_age` must be numbers if provided
- `min_experience_years` defaults to 0

**UI Details:**
- The preview table shows: row number, title, company, location, resolved lat/lng status (checkmark or warning icon), and any validation errors
- Import button is disabled until at least one valid row exists
- Progress indicator during import
- After successful import, the jobs list auto-refreshes
