

## Update Bulk Import: New CSV Format + Upsert by `external_job_id`

### Overview
Two changes are needed:
1. **New CSV columns**: The CSV now includes `wages_per_month` and `wages_per_day` (between `salary_range` and `gender_requirement`). The template and parser must accept these.
2. **Upsert logic**: Instead of always inserting, the importer should skip jobs that already exist in the database (matched by `external_job_id` = CSV `job_id`). Only new jobs get inserted.

### Changes

#### 1. Update `CsvRow` interface and `CSV_HEADERS`
- Add `wages_per_month` and `wages_per_day` to the `CsvRow` interface and the `CSV_HEADERS` array so the parser recognizes them.

#### 2. Pre-fetch existing `external_job_id` values
- At the start of `importRows`, query the `jobs` table for all existing `external_job_id` values: `select('external_job_id')`.
- Build a `Set<string>` of existing IDs.

#### 3. Filter out existing jobs during processing
- In `processRows`, add a new field `isExisting: boolean` to `ParsedRow` (default `false`).
- After CSV parsing, the modal will mark rows whose `job_id` already exists in the database.
- These rows will show a "Duplicate" status in the preview table instead of "Ready".
- They will be excluded from the import count and the actual insert.

#### 4. Update the preview table UI
- Add a new badge showing the count of skipped/duplicate rows (e.g., "42 existing").
- Rows marked as existing will show a grey "Exists" label in the Status column.
- The import button text will reflect only new jobs: "Import X New Jobs".

#### 5. Update `importRows` to skip existing
- Filter out rows where `isExisting === true` before inserting.
- Return updated stats: `{ inserted, skipped, locationWarnings }`.

#### 6. Update the template download
- The downloaded CSV template will include the two new columns.

### Technical Details

**File: `src/hooks/useBulkImportJobs.ts`**
- Add `wages_per_month` and `wages_per_day` to `CsvRow` and `CSV_HEADERS`.
- Add `isExisting: boolean` to `ParsedRow`.
- New function `fetchExistingJobIds()` that returns a `Set<string>` of all `external_job_id` values from the `jobs` table.
- `processRows` accepts an optional `existingIds: Set<string>` parameter; marks rows with matching `job_id` as `isExisting: true`.
- `importRows` filters out `isExisting` rows before inserting, returns `{ inserted, skipped, locationWarnings }`.

**File: `src/components/BulkImportJobsModal.tsx`**
- After CSV parse + `processRows`, call `fetchExistingJobIds()` and update rows with the `isExisting` flag.
- Add "X existing" badge in the summary row.
- Show "Exists" status for duplicate rows in the table.
- Update import button: "Import X New Jobs".
- Update success toast to include skipped count.

### User Experience Flow
1. User uploads CSV with 181 jobs.
2. System parses all rows, resolves locations, and checks which `job_id` values already exist in the database.
3. Preview table shows existing jobs greyed out with "Exists" status.
4. Summary badges show: "181 rows | 39 new | 142 existing | 0 errors".
5. Import button says "Import 39 New Jobs".
6. Only the 39 new jobs are inserted.

