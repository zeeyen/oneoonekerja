

## Add Job Type Filter and Display Job Type + Job ID on Detail Page

### 1. Jobs Page -- Add `job_type` filter dropdown

Add a new Select dropdown (alongside the existing Status, Industry, State filters) with options:
- All Types (default)
- Freelance
- Long Term

**Files changed:**
- `src/pages/JobsPage.tsx` -- Add `jobTypeFilter` state, render a new Select dropdown, pass it to `useJobs`
- `src/hooks/useJobs.ts` -- Accept `jobTypeFilter` in `UseJobsOptions`, apply `.eq('job_type', ...)` filter when not "all"

### 2. Job Detail Page -- Show Job ID and Job Type

Add two new fields to the Job Details card:
- **Job ID** (e.g. "JOB130") -- display `job.external_job_id` with a tag/hash icon
- **Job Type** (e.g. "Freelance") -- display `job.job_type` with a briefcase icon

These will be added to the existing details grid alongside Salary, Location, Industry, etc.

**File changed:**
- `src/pages/JobDetailPage.tsx` -- Add Job ID and Job Type fields in the details grid. Also show the external_job_id in the header area next to the title for quick reference.

### Technical Details

**`src/hooks/useJobs.ts`**
- Add `jobTypeFilter: string` to `UseJobsOptions`
- Add filter: `if (jobTypeFilter && jobTypeFilter !== 'all') { query = query.eq('job_type', jobTypeFilter); }`

**`src/pages/JobsPage.tsx`**
- New state: `const [jobTypeFilter, setJobTypeFilter] = useState<string>('all');`
- New Select dropdown after the State filter with options: All Types, Freelance, Long Term
- Pass `jobTypeFilter` to `useJobs()`
- Reset page on filter change (already handled by existing useMemo)

**`src/pages/JobDetailPage.tsx`**
- In the header card, show `external_job_id` as a muted badge/text next to the title
- In the details grid left column, add Job Type field showing `job.job_type || 'Not specified'`
