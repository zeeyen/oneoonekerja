

## Fix Applicants Page: Filter Bug, Funnel Widget, and CSV Export

### 1. Bug Fix: Missing "matching" status

**Root cause**: The database contains applicants with `onboarding_status = 'matching'` (8 records), but this status is not defined in the TypeScript type or filter/display config. These applicants fall back to displaying as "New" but are not returned when filtering by "New" (which queries `onboarding_status = 'new'`).

**Fix**:
- **`src/types/database.ts`**: Add `'matching'` to the `onboarding_status` union type
- **`src/lib/applicantStatusConfig.ts`**: Add a `matching` entry to `onboardingStatusConfig` with a distinct style (e.g., purple badge: "Matching")
- **`src/hooks/useApplicants.ts`**: Add a `'matching'` filter case with `query.eq('onboarding_status', 'matching')`
- **`src/pages/ApplicantsPage.tsx`**: Add `{ value: 'matching', label: 'Matching' }` to `filterOptions`

### 2. Funnel Widget

Add a new hook and component above the table:

- **`src/hooks/useApplicantFunnelCounts.ts`** (new file): A hook that queries applicant counts grouped by `onboarding_status` using a single Supabase query (select with `head: true` and `count: 'exact'` per status, or a single query grouping). Will return counts for: New, In Progress, Matching, Completed, and Banned.

- **`src/components/ApplicantFunnel.tsx`** (new file): A horizontal row of clickable cards, each showing a status label, count, and a visual bar/indicator showing relative proportion. Clicking a card sets the page's `filter` state to that status. The active filter is visually highlighted.

Layout (horizontal cards):
```text
[ New: 1 ] --> [ In Progress: 10 ] --> [ Matching: 8 ] --> [ Completed: 11 ]
```
Each card is clickable and triggers the filter. An "All" option clears the filter.

- **`src/pages/ApplicantsPage.tsx`**: Insert the funnel component between the header and the search/filter card. Pass `filter` and `setFilter` as props. Remove the dropdown `Select` filter since the funnel replaces it.

### 3. CSV Export

- **`src/pages/ApplicantsPage.tsx`**: Add a "Download CSV" button next to the search bar. When clicked:
  - Fetch ALL applicants matching the current search and filter (not just the current page) using a dedicated query with no pagination
  - Convert to CSV format with columns: Name, Phone, IC Number (masked for non-admin), Location, Status, Last Active
  - Trigger a browser download of the generated CSV file

- **`src/hooks/useApplicants.ts`**: Add a `fetchAllApplicants` function that accepts search/filter but no pagination, fetching in chunks of 1000 to bypass the Supabase row limit.

### Technical Details

**Funnel counts query** will use individual count queries per status to avoid the 1000-row limit:
```sql
SELECT onboarding_status, count(*) FROM applicants GROUP BY onboarding_status
```
This will be done via an RPC or multiple head-only queries.

**CSV generation** will use a utility function that:
- Escapes commas and quotes in field values
- Masks IC numbers for non-admin users (reusing existing `maskSensitiveData` logic)
- Formats dates as readable strings
- Handles null values gracefully

**Files to create**:
- `src/hooks/useApplicantFunnelCounts.ts`
- `src/components/ApplicantFunnel.tsx`

**Files to modify**:
- `src/types/database.ts` (add 'matching' to union)
- `src/lib/applicantStatusConfig.ts` (add matching config)
- `src/hooks/useApplicants.ts` (add matching filter case + fetchAllApplicants)
- `src/pages/ApplicantsPage.tsx` (add funnel, CSV button, matching filter option)
