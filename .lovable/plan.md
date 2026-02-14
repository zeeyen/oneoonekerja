

## Add Time Filter to Applicants Page

### What We're Building

A time filter button group (Last 24h, 7 days, 1 month, All time) on the Applicants page that filters both the funnel widget counts and the applicants table by `last_active_at`. This reuses the same `TimeFilter` type and `getSinceDate` helper already in `src/hooks/useJobStats.ts`.

### Previous Bug Fix

The last implementation attempt had a bug where the page broke for non-"All time" filters. The root cause was that applying `.gte('last_active_at', since)` without guarding for `null` values or without properly passing the `since` parameter through all code paths caused query failures. This implementation will:

- Only add the `.gte()` filter when `since` is not null (i.e., not "All time")
- Properly thread the `since` parameter through the query key so React Query caches correctly per time filter
- Apply the filter consistently to both the funnel counts and the main table query

### Files to Change

**1. `src/hooks/useApplicantFunnelCounts.ts`**

- Change `fetchFunnelCounts` to accept `since: string | null`
- When `since` is not null, add `.gte('last_active_at', since)` to each count query and the total query
- Update `useApplicantFunnelCounts` to accept `since` and include it in the query key

**2. `src/hooks/useApplicants.ts`**

- Add optional `since?: string | null` to `UseApplicantsOptions`
- When `since` is provided and not null, add `.gte('last_active_at', since)` to the main query
- Do the same for `fetchAllFilteredApplicants` (used by CSV export)

**3. `src/components/ApplicantFunnel.tsx`**

- Add `since?: string | null` to props
- Pass it to `useApplicantFunnelCounts(since)`

**4. `src/pages/ApplicantsPage.tsx`**

- Import `TimeFilter` and `getSinceDate` from `src/hooks/useJobStats`
- Add `timeFilter` state defaulting to `'all'`
- Compute `since = getSinceDate(timeFilter)`
- Pass `since` to `useApplicants`, `ApplicantFunnel`, and CSV export
- Render a button group between the funnel and the search card, matching the Jobs page style
- Reset page to 1 when time filter changes

### UI Placement

The time filter buttons appear between the Applicant Funnel and the search/export card:

```text
[Funnel: All | New | In Progress | Matching | Completed | Banned]

[Last 24h]  [7 days]  [1 month]  [All time]     <-- new row

[Search bar...]                    [Download CSV]
```

### Technical Details

- Reuses `TimeFilter` type and `getSinceDate()` from `src/hooks/useJobStats.ts` (no duplication)
- The "total applicants" count in the page header remains unfiltered (all-time) via the existing `useTotalApplicantsCount` hook
- The funnel counts update dynamically when time filter changes
- CSV export respects the active time filter
- Query keys include `since` so each time range is cached independently
- The `.gte('last_active_at', since)` filter is only appended when `since !== null`, preventing any issues with the "All time" option

