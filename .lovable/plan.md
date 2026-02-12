

## Update Existing Jobs' Location Fields During Bulk Upload

### Overview
Currently, the bulk importer skips rows where `external_job_id` already exists in the database. This change will detect differences in `location`, `postcode`, `city`, and `state` for existing jobs and update them automatically.

### Changes

#### 1. `src/hooks/useBulkImportJobs.ts`

**Expand `fetchExistingJobIds` to return full location data:**
- Rename to `fetchExistingJobs` (keep the old name exported as an alias for compatibility)
- Instead of returning `Set<string>`, return `Map<string, { id: string, location_address: string | null, postcode: string | null, location_city: string | null, location_state: string | null }>`
- Query includes `id, external_job_id, location_address, postcode, location_city, location_state`

**Add fields to `ParsedRow` interface:**
- `hasLocationChanges: boolean` -- true if any of the 4 fields differ from the DB
- `locationChanges: string[]` -- list of changed field names for display (e.g., `["city", "state"]`)
- `existingJobDbId: string | null` -- the UUID of the existing job (needed for the UPDATE query)

**Update `processRows`:**
- Accept the new Map instead of Set
- For existing rows, compare CSV values against stored DB values for location_address, postcode, location_city, location_state
- Populate `hasLocationChanges` and `locationChanges`

**Add `updateExistingRows` function:**
- Filters rows where `isExisting && hasLocationChanges`
- For each, runs a Supabase `.update()` on the `jobs` table by `id` (UUID), setting the 4 location fields plus re-resolved coordinates and `last_edited_at`/`last_edited_by`
- Processes in chunks of 50
- Returns `{ updated: number }`

**Update `importRows` return type:**
- Add `updated: number` to the result
- Call `updateExistingRows` before or after inserting new rows

#### 2. `src/components/BulkImportJobsModal.tsx`

**Update summary badges:**
- Add a new badge for rows with location changes (e.g., "3 updates" in blue)
- Change the "Exists" status to show "Update" with a different icon when `hasLocationChanges` is true

**Update import button and result toast:**
- Button text: `Import ${newCount} New, Update ${updateCount} Existing`
- Toast includes update count

**Update table status column:**
- Existing rows with changes show "Update (city, state)" instead of just "Exists"
- Use a distinct color/icon (e.g., blue RefreshCw icon)

### Technical Details

- Comparison is case-insensitive and treats empty/null/`"NULL"` as equivalent
- Coordinates are re-resolved (local + AI) for rows with location changes, using the same resolution pipeline as new rows
- The AI resolve step will also include existing rows that have location changes but unresolved coordinates
- Updates use `.update()` with `.eq('id', dbUuid)` for safety (not by external_job_id)

