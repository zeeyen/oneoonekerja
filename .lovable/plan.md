

## Add Job Match and Selection Widgets to Jobs Page

### What We're Building

Two clickable data widgets at the top of the Jobs page that show:
1. **Jobs Matched** -- How many unique jobs have been presented to applicants as matches
2. **Jobs Selected** -- How many unique jobs have been selected/applied to by applicants

Each widget is clickable and switches the table to a filtered view sorted by match/selection count descending, with a new count column. A time filter (Last 24h, 7 days, 1 month, All time) controls both widgets and the filtered views.

### Data Sources

- **Matched jobs**: Extracted from `applicants.conversation_state->'matched_jobs'` JSONB arrays. Each applicant currently in matching state has an array of job objects with `id` fields. We'll create a Supabase database function to aggregate this efficiently.
- **Selected jobs**: Queried from `job_selections` table, which has `selected_at` timestamps and `job_id` foreign keys. Currently 27 records across 17 unique jobs.

### Database Changes

**Create a Postgres function** `get_job_match_counts(since timestamptz)` that:
- Unnests `conversation_state->'matched_jobs'` from all applicants (optionally filtered by `updated_at >= since`)
- Extracts each job's `id` from the JSONB array
- Returns `job_id` and `match_count` grouped and sorted descending

This avoids complex client-side JSONB parsing and keeps queries fast.

### File Changes

**1. New hook: `src/hooks/useJobStats.ts`**

- `useJobMatchCounts(since)` -- Calls the DB function to get per-job match counts
- `useJobSelectionCounts(since)` -- Queries `job_selections` grouped by `job_id` with a `selected_at >= since` filter
- `useJobMatchedTotal(since)` -- Returns total unique jobs matched count for the widget
- `useJobSelectedTotal(since)` -- Returns total unique jobs selected count for the widget

**2. Modify: `src/pages/JobsPage.tsx`**

- Add state: `activeWidget` (`null | 'matched' | 'selected'`) and `timeFilter` (`'24h' | '7d' | '1m' | 'all'`)
- Add two stat cards between the page header and search card (similar style to Dashboard stat cards)
- Add a time filter row (button group) next to or below the widgets
- When a widget is clicked, `activeWidget` toggles on/off and the job table switches to a special view:
  - Fetches jobs joined with the match/selection count data
  - Adds a "Times Matched" or "Times Selected" column
  - Sorted by that count descending
  - Clicking again returns to the normal table view
- The time filter controls the `since` parameter passed to both widget queries and the filtered table

### UI Layout

```text
+---------------------------+---------------------------+
|  Jobs Matched             |  Jobs Selected            |
|  12 unique jobs           |  17 unique jobs           |
|  (click to filter)        |  (click to filter)        |
+---------------------------+---------------------------+
  [Last 24h] [7 days] [1 month] [All time]

  [Search bar...]
  [Status] [Industry] [State]

  +------+-------+--------+----------+----+--------+-------+----------+
  | ID   | Title | Company| Location |... | Salary | Expires| Matched* |
  +------+-------+--------+----------+----+--------+-------+----------+
```

*The "Matched" or "Selected" column only appears when the corresponding widget is active.*

### Technical Details

**Database function SQL:**

```sql
CREATE OR REPLACE FUNCTION get_job_match_counts(since_ts timestamptz DEFAULT NULL)
RETURNS TABLE(job_id uuid, match_count bigint) AS $$
  SELECT 
    (elem->>'id')::uuid as job_id,
    count(DISTINCT a.id) as match_count
  FROM applicants a,
    jsonb_array_elements(a.conversation_state->'matched_jobs') as elem
  WHERE a.conversation_state->'matched_jobs' IS NOT NULL
    AND jsonb_array_length(a.conversation_state->'matched_jobs') > 0
    AND (since_ts IS NULL OR a.updated_at >= since_ts)
  GROUP BY (elem->>'id')::uuid
  ORDER BY match_count DESC;
$$ LANGUAGE sql STABLE;
```

**Time filter calculation** (client-side):

| Filter | `since` value |
|--------|--------------|
| Last 24h | `new Date(Date.now() - 86400000).toISOString()` |
| 7 days | `new Date(Date.now() - 7*86400000).toISOString()` |
| 1 month | `new Date(Date.now() - 30*86400000).toISOString()` |
| All time | `null` |

**Widget click behavior:**
- Clicking an active widget deactivates it (returns to normal job list)
- Clicking an inactive widget activates it and deactivates the other
- The filtered view merges count data with the existing job query results client-side (joins `job_id` from counts with the jobs list)

### Files Summary

| File | Action |
|------|--------|
| Database migration | Create `get_job_match_counts` function |
| `src/hooks/useJobStats.ts` | New file -- hooks for match/selection counts |
| `src/pages/JobsPage.tsx` | Add widgets, time filter, filtered table view |

