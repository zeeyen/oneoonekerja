

## Add Job ID Column and Search to Jobs Page

### Overview
Add the `external_job_id` as a new "Job ID" column (first column in the table) and extend the search to also match against it.

### Changes

#### 1. `src/pages/JobsPage.tsx`
- **Search placeholder**: Change from "Search by title or company..." to "Search by Job ID, title or company..."
- **Table header**: Add a new `<TableHead>Job ID</TableHead>` as the first column, before "Title"
- **Table body**: Add a new `<TableCell>` displaying `job.external_job_id || '-'` as the first cell in each row, styled with `font-mono text-sm text-muted-foreground` for readability

#### 2. `src/hooks/useJobs.ts`
- **Search filter**: Update the `.or()` clause in `fetchJobs` to also match `external_job_id`:
  - From: `title.ilike.${searchTerm},company.ilike.${searchTerm}`
  - To: `title.ilike.${searchTerm},company.ilike.${searchTerm},external_job_id.ilike.${searchTerm}`

### Technical Notes
- The `external_job_id` column already exists in the `jobs` table and is included in the query (`select('*')`), so no database changes are needed.
- The minimum table width may need a slight increase (from `min-w-[700px]` to `min-w-[800px]`) to accommodate the new column.

