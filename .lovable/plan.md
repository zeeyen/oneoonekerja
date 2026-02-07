

## Backfill Geocoding for Existing Jobs with Missing Coordinates

### Problem
There are ~20+ jobs already in the database with null `latitude`/`longitude` despite having usable location data (`location_address`, `postcode`, `location_city`, `location_state`). The AI geocoding fallback only runs during CSV import -- it does not retroactively fix existing records.

### Solution
Add a "Backfill Coordinates" button on the Jobs page that:
1. Queries all jobs where `latitude IS NULL` and at least one location field is populated
2. Calls the existing `geocode-location` edge function for each job (throttled, 200ms delay)
3. Updates each job's `latitude`/`longitude` in the database
4. Shows progress and results

### Files to Change

**`src/pages/JobsPage.tsx`**:
- Add a "Backfill Coordinates" button (visible to admins) near the existing action buttons
- Wire it to a new hook

**`src/hooks/useBackfillGeocode.ts`** (new file):
- Query jobs where `latitude IS NULL AND (location_address IS NOT NULL OR location_city IS NOT NULL OR postcode IS NOT NULL)`
- For each job, call `supabase.functions.invoke('geocode-location', { body: { city, state, location_address, postcode, country } })`
- On success, update the job record with the returned lat/lng
- Throttle calls with 200ms delay to avoid rate limits
- Track progress (current/total) and results (resolved count, failed count)
- Handle 429/402 errors gracefully by stopping early

### UI Behavior
- Button shows "Backfill Coordinates (N unresolved)" with count of jobs needing resolution
- While running: progress bar or text "Resolving... 5/20"
- On completion: toast with "Resolved 18/20 jobs. 2 could not be resolved."
- Button is disabled while backfill is in progress

### Technical Details

Query for unresolved jobs:
```sql
SELECT id, location_city, location_state, location_address, postcode, country
FROM jobs
WHERE latitude IS NULL
  AND (location_address IS NOT NULL OR location_city IS NOT NULL OR postcode IS NOT NULL)
```

For each result, call the edge function and update:
```typescript
const { data } = await supabase.functions.invoke('geocode-location', {
  body: { city: job.location_city, state: job.location_state, 
          location_address: job.location_address, postcode: job.postcode, 
          country: job.country || 'Malaysia' }
});
if (data?.latitude && data?.longitude) {
  await supabase.from('jobs').update({ latitude: data.latitude, longitude: data.longitude }).eq('id', job.id);
}
```

No new edge functions or migrations needed -- this reuses the existing `geocode-location` function.
