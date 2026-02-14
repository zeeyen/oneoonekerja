

## Add Time Filter to Applicants Page (Bug-Free Approach)

### Root Cause of Previous Bug

The previous implementation computed `getSinceDate(timeFilter)` during each render, producing a new ISO timestamp string every time (e.g., `2026-02-13T01:12:34.567Z` vs `2026-02-13T01:12:34.568Z`). When this ever-changing string was included in React Query's `queryKey`, it triggered an infinite cycle: new key causes a new fetch, which causes a re-render, which produces a new key...

### The Fix

Use the **stable `timeFilter` string** (e.g., `'24h'`, `'7d'`) in query keys. Call `getSinceDate()` only **inside** the `queryFn` where it runs once per fetch, not on every render.

### Files to Change

**1. `src/hooks/useApplicantFunnelCounts.ts`**

- Import `TimeFilter` and `getSinceDate` from `useJobStats`
- Change `fetchFunnelCounts` to accept `timeFilter: TimeFilter` (not a date string)
- Inside the function body, compute `const since = getSinceDate(timeFilter)`
- When `since` is not null, add `.gte('last_active_at', since)` to each count query
- Update `useApplicantFunnelCounts` to accept `timeFilter` and use it in the query key: `['applicant-funnel-counts', timeFilter]`

**2. `src/hooks/useApplicants.ts`**

- Import `TimeFilter` and `getSinceDate` from `useJobStats`
- Add optional `timeFilter?: TimeFilter` to `UseApplicantsOptions` (default `'all'`)
- Inside `fetchApplicants`, compute `since` from `timeFilter` and apply `.gte('last_active_at', since)` when not null
- The query key already includes the full `options` object, so adding `timeFilter` to it is sufficient
- Update `fetchAllFilteredApplicants` to accept `timeFilter` and apply the same filter for CSV export

**3. `src/components/ApplicantFunnel.tsx`**

- Add `timeFilter?: TimeFilter` to props (default `'all'`)
- Pass it to `useApplicantFunnelCounts(timeFilter)`

**4. `src/pages/ApplicantsPage.tsx`**

- Import `TimeFilter` from `useJobStats`
- Add `timeFilter` state defaulting to `'all'`
- Pass `timeFilter` to `useApplicants`, `ApplicantFunnel`, and CSV export
- Render a button group between the funnel and the search card
- Reset page to 1 when time filter changes

### Why This Won't Break

| Previous (broken) | New (fixed) |
|---|---|
| `getSinceDate()` called on every render | `getSinceDate()` called inside `queryFn` only |
| Query key: `['applicants', { since: "2026-02-13T..." }]` -- changes every ms | Query key: `['applicants', { timeFilter: '24h' }]` -- stable string |
| Infinite re-render loop | Stable caching, fetches only when `timeFilter` changes |

### UI Layout

The time filter buttons appear between the Applicant Funnel and the search/export card:

```text
[Funnel: All | New | In Progress | Matching | Completed | Banned]

[Last 24h]  [7 days]  [1 month]  [All time]

[Search bar...]                    [Download CSV]
```

### Technical Notes

- Reuses existing `TimeFilter` type and `getSinceDate()` from `src/hooks/useJobStats.ts`
- The page header "total applicants" count stays unfiltered via the existing `useTotalApplicantsCount` hook
- Funnel counts and table both update when time filter changes
- CSV export respects the active time filter
- The `.gte('last_active_at', since)` filter is only appended when `since !== null`

