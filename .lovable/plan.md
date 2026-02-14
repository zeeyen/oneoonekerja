

## Add Time Filter to Applicants Page

Add a time filter button group (Last 24h, 7 days, 1 month, All time) to the Applicants page, filtering both the funnel counts and the applicants table by `last_active_at`.

### Changes

**1. `src/hooks/useApplicants.ts`**
- Add an optional `since: string | null` parameter to `UseApplicantsOptions`
- When `since` is provided, add `.gte('last_active_at', since)` to the query
- Do the same for `fetchAllFilteredApplicants` (CSV export)

**2. `src/hooks/useApplicantFunnelCounts.ts`**
- Accept an optional `since: string | null` parameter
- When provided, add `.gte('last_active_at', since)` to each count query
- Update the query key to include the time filter

**3. `src/components/ApplicantFunnel.tsx`**
- Pass `since` through to `useApplicantFunnelCounts`

**4. `src/pages/ApplicantsPage.tsx`**
- Import `TimeFilter` and `getSinceDate` from `src/hooks/useJobStats.ts` (reuse existing types)
- Add `timeFilter` state defaulting to `'all'`
- Render a button group row (Last 24h / 7 days / 1 month / All time) between the funnel and the search bar
- Pass `getSinceDate(timeFilter)` into `useApplicants` and `ApplicantFunnel`
- Pass it to CSV export as well

### UI Placement

The time filter buttons will appear between the Applicant Funnel widget and the search/export card, matching the same style used on the Jobs page.

### Technical Details

- Reuses the existing `TimeFilter` type and `getSinceDate` helper from `src/hooks/useJobStats.ts` for consistency
- Filters on `last_active_at` since it represents the applicant's most recent activity timestamp
- The funnel counts will update dynamically when the time filter changes
- The "total applicants" count in the page header remains unfiltered (all-time)
- CSV export respects the active time filter

### Files Changed

| File | Action |
|------|--------|
| `src/hooks/useApplicants.ts` | Add `since` filter to queries |
| `src/hooks/useApplicantFunnelCounts.ts` | Accept and apply `since` parameter |
| `src/components/ApplicantFunnel.tsx` | Pass `since` to hook |
| `src/pages/ApplicantsPage.tsx` | Add time filter state and UI |

