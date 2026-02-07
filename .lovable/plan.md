

## Adapt Bulk Import to Match Real CSV Format

### Problem
The current bulk import expects a custom template with specific column names (`title`, `company`, `expire_by`, etc.), but the actual export file uses different column names (`job_title`, `company_name`, `end_date`, etc.) and different data formats (dates as DD/MM/YYYY, gender as "Both" instead of "any", and literal "NULL" strings).

### Column Mapping

| Source CSV Column  | Maps To (DB)         | Transform Needed                     |
|--------------------|----------------------|--------------------------------------|
| `job_title`        | `title`              | Direct                               |
| `company_name`     | `company`            | Direct                               |
| `city`             | `location_city`      | Strip "NULL" strings                 |
| `state`            | `location_state`     | Strip "NULL" strings                 |
| `salary_range`     | `salary_range`       | Direct (keep as-is, e.g. "RM 102/day") |
| `gender_requirement` | `gender_requirement` | "Both" to "any", lowercase           |
| `url`              | `url`                | Direct                               |
| `end_date`         | `expire_by`          | Convert DD/MM/YYYY to YYYY-MM-DD     |
| `age_min`          | `min_age`            | Direct number                        |
| `age_max`          | `max_age`            | Direct number                        |
| (not present)      | `industry`           | Default to null                      |
| (not present)      | `min_experience_years` | Default to 0                       |
| `id`, `job_id`, `location`, `postcode`, `country`, `created_at` | (ignored) | Skipped during import |

### Changes

**File: `src/hooks/useBulkImportJobs.ts`**

1. Update `CSV_HEADERS` to match the source file columns: `id, job_id, job_title, company_name, location, postcode, city, state, country, salary_range, gender_requirement, url, created_at, end_date, age_min, age_max`
2. Update `CsvRow` interface to match these source column names
3. Add a transform step that maps source columns to DB fields:
   - `job_title` to `title`
   - `company_name` to `company`
   - `city` to `location_city` (treat "NULL" as empty)
   - `state` to `location_state` (treat "NULL" as empty)
   - `end_date` DD/MM/YYYY to `expire_by` YYYY-MM-DD
   - `gender_requirement` "Both" to "any"
   - `age_min`/`age_max` renamed to `min_age`/`max_age`
4. Update `validateRow` to work with the new field names
5. Update `generateCsvTemplate()` to output the correct source headers
6. Update date validation to accept DD/MM/YYYY format (converting internally)

**File: `src/components/BulkImportJobsModal.tsx`**

7. No structural changes needed -- the preview table already reads from `raw.title`, `raw.company`, etc. These references will be updated to match the new `CsvRow` field names (`raw.job_title`, `raw.company_name`, `raw.city`, `raw.state`, `raw.end_date`)

### Data Handling Details

- **"NULL" strings**: The source CSV uses literal `NULL` text for missing values. The parser will treat any value that is exactly "NULL" (case-insensitive) as empty.
- **Date conversion**: `DD/MM/YYYY` will be parsed and converted to `YYYY-MM-DD` for the database. Invalid dates will show a validation error.
- **Gender mapping**: "Both" maps to "any", "Male" to "male", "Female" to "female".
- **Template download**: Will generate headers matching the source CSV format so users can fill in new data using the same structure.

