

## Root Cause: Missing Federal Territory Data in `malaysia_locations` Table

The `malaysia_locations` table has **427 rows across 13 states** but is completely missing all **Federal Territory** entries:
- **Kuala Lumpur** (not listed as a state at all)
- **Putrajaya** (missing)
- **Labuan** (missing)

This means towns like Kepong, Segambut, Setapak, Wangsa Maju, Cheras (KL side), Sentul, Titiwangsa — none exist in the table.

The Selangor entries also lack several key KL-adjacent towns.

### Why GPT Geocoding Also Fails

During **location clarification mode** (when the bot already has name/age/gender and is re-asking for location), the code calls `extractSpecificFields` or `extractAllInfo` with just the city name (e.g., "Kepong"). GPT returns `lat: null, lng: null` — likely because the focused extraction prompt doesn't carry the full coordinate reference list, and the model sometimes fails on short single-word inputs.

The fallback chain is: GPT coords → DB lookup → give up. Both fail, so the bot loops asking for location clarification indefinitely.

### Fix Plan

**1. Insert Federal Territory locations into `malaysia_locations` table**

Add ~40-50 rows covering:

- **W.P. Kuala Lumpur** (state): Kepong, Segambut, Setapak, Wangsa Maju, Sentul, Cheras (KL), Bukit Jalil, Sri Petaling, Bangsar, Mont Kiara, Hartamas, Titiwangsa, Batu, Jinjang, Setiawangsa, Taman Tun Dr Ismail (TTDI), Desa Petaling, Salak Selatan, Kuala Lumpur (city center)
- **W.P. Putrajaya**: Putrajaya
- **W.P. Labuan**: Labuan

Also add missing Selangor towns: Damansara, Kota Damansara, USJ, Pandan Indah, Taman Melawati, etc.

**2. Add aliases for common spelling variations**

The `malaysia_locations` table has an `aliases` column (text[]). Populate aliases for entries like:
- Kuala Lumpur → aliases: `['kl', 'KL']`
- Kepong → aliases: `['kepong baru']`

**3. Update the DB lookup to also search the `aliases` column**

Currently `getMalaysiaLocationCandidates` only searches the `name` column. Modify to also match against `aliases` array using Supabase's `cs` (contains) or a dedicated query.

### Technical Details

The `malaysia_locations` table schema:
```
name (varchar), state (varchar), latitude (numeric), longitude (numeric), 
aliases (text[]), state_code (varchar), is_geocoded (boolean)
```

Changes needed:
- **SQL INSERT**: ~50 rows for Federal Territory + missing Selangor locations
- **`location.ts`**: Update `getMalaysiaLocationCandidates()` to add an alias-based fallback query when exact name match fails
- **No changes** to onboarding flow, extraction, or state machine — the issue is purely missing reference data + incomplete lookup

