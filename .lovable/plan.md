

## AI-Powered Geocoding Fallback via Lovable AI Gateway

### Overview
When the local `malaysia_locations` lookup fails to resolve lat/lng for a job, use the Lovable AI Gateway as a final fallback. An edge function will send the location fields (city, state, location_address, postcode, country) to the AI model and ask it to return coordinates.

### Architecture

```text
CSV Import (browser)
  |
  v
Local lookup (malaysia_locations table)
  |
  +--> Resolved? Done.
  |
  +--> Not resolved? Call edge function
         |
         v
       Edge Function: geocode-location
         |
         v
       Lovable AI Gateway (google/gemini-3-flash-preview)
         |
         v
       Returns { latitude, longitude } or null
```

### Edge Function: `supabase/functions/geocode-location/index.ts`

- Accepts POST with `{ city, state, location_address, postcode, country }`
- Calls Lovable AI Gateway at `https://ai.gateway.lovable.dev/v1/chat/completions`
- Uses tool calling to extract structured `{ latitude, longitude }` output
- Model: `google/gemini-3-flash-preview` (fast, cheap)
- Returns JSON `{ latitude: number, longitude: number }` or `{ latitude: null, longitude: null }` if unresolvable
- Handles 429/402 errors gracefully

Prompt strategy:
```
You are a geocoding assistant. Given location details in Malaysia, 
return the latitude and longitude of the most likely location.
```

With tool definition:
```json
{
  "name": "return_coordinates",
  "parameters": {
    "properties": {
      "latitude": { "type": "number" },
      "longitude": { "type": "number" }
    }
  }
}
```

### Changes to `src/hooks/useBulkImportJobs.ts`

- After `resolveLocation` returns null, collect unresolved rows
- Batch-call the edge function for unresolved rows (one call per row, throttled to avoid rate limits)
- Update the row's `latitude`/`longitude` with AI results before insert
- Add a small delay between calls (e.g., 200ms) to respect rate limits

### Changes to `src/components/BulkImportJobsModal.tsx`

- Add a new status indicator: "AI-resolved" (distinct from locally resolved)
- Show progress during AI resolution phase ("Resolving locations... X/Y")
- Add a secondary step between parsing and importing: location resolution

### Flow Update

Current flow: Upload CSV -> Parse -> Preview -> Import

New flow: Upload CSV -> Parse -> Preview -> **Resolve locations (AI fallback)** -> Updated Preview -> Import

The AI resolution step runs automatically after parsing. Rows that were unresolved locally get sent to the edge function. The preview table updates with resolved coordinates.

### Cost and Rate Limit Considerations

- Each unresolved row = 1 AI call (very small prompt, minimal tokens)
- `google/gemini-3-flash-preview` is the cheapest/fastest option
- Batch imports with many unresolved rows could hit rate limits; add 200ms delay between calls
- Surface 429/402 errors as warnings (skip AI resolution for remaining rows, proceed with import)

### Files to Create/Change

1. **Create** `supabase/functions/geocode-location/index.ts` -- edge function
2. **Update** `supabase/config.toml` -- register the function
3. **Update** `src/hooks/useBulkImportJobs.ts` -- add AI fallback after local resolution
4. **Update** `src/components/BulkImportJobsModal.tsx` -- show AI resolution progress and status

