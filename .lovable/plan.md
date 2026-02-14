

## Fix: Show Job Selections on Applicant Detail Page

### Root Cause

The bot-processor stores job selections in the `job_selections` table, but the Applicant Detail page only queries `job_matches` (which has 0 records). The `job_matches` table is unused -- all 26 actual selections are in `job_selections`.

### Changes

**1. Update `src/hooks/useApplicantDetail.ts`**

- Add a new `useApplicantJobSelections` hook that queries `job_selections` by `user_id`
- Keep the existing `useApplicantJobMatches` hook for backward compatibility (or remove it since `job_matches` is empty)

**2. Update `src/pages/ApplicantDetailPage.tsx`**

- Import and call `useApplicantJobSelections`
- Replace (or supplement) the Job Matches tab content with job selections data
- Display columns: Job Title, Company, Location (city + state), Apply URL, Selected At
- Rename the tab from "Job Matches" to "Job Selections" to match the data source

### Tab Display

The "Job Selections" tab will show a table with:

| Column | Source |
|--------|--------|
| Job Title | `job_selections.job_title` |
| Company | `job_selections.company` |
| Location | `job_selections.location_city`, `location_state` |
| Apply Link | `job_selections.apply_url` (clickable) |
| Selected At | `job_selections.selected_at` |

### Technical Details

- The `job_selections` table has RLS policies allowing dashboard users to view, so no database changes needed
- The query will filter by `user_id` matching the applicant's ID
- Results ordered by `selected_at` descending (most recent first)
- The existing `job_matches` query can be removed since the table has 0 records and isn't used by the bot

### Files Changed

- `src/hooks/useApplicantDetail.ts` -- add `useApplicantJobSelections` hook
- `src/pages/ApplicantDetailPage.tsx` -- wire up job selections data and update the tab UI
