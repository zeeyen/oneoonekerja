

## Fix: Allow DB Lookup for Ambiguous Locations

### Problem
When GPT flags a location as ambiguous (e.g., "Segambut" → KL vs Selangor), the DB lookup is skipped entirely because of the condition `!merged.ambiguous`. But the `malaysia_locations` table has the correct answer (Segambut is only in KL). The DB lookup should always run so it can override GPT's false ambiguity when it finds the location in only one state.

### Change
**File**: `supabase/functions/bot-processor/extraction.ts`

**Line 224**: Change from:
```typescript
if (merged.city && !merged.ambiguous) {
```

to:
```typescript
if (merged.city) {
```

### Impact
- DB lookup now runs even when GPT marks a location as ambiguous
- If the DB finds the city in only one state, it overrides the false ambiguity
- If the DB confirms the city exists in multiple states, `ambiguous_states` is still returned and the ambiguity remains

