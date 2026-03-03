// location.ts — Distance calculation, Malaysia location lookup, and geocoding

import { supabase, OPENAI_API_KEY } from './config.ts'
import { normalizeLooseText } from './helpers.ts'
import { normalizeLocationInput, normalizeStateAlias } from './slots.ts'
import type { User } from './types.ts'

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  // Returns distance in kilometers (Haversine formula)
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// ============================================
// MALAYSIA LOCATION TABLE LOOKUP
// ============================================
export interface LocationResolveResult {
  lat: number
  lng: number
  state: string
  city?: string
  ambiguous_states?: string[]
}

export interface MalaysiaLocationRow {
  name: string
  state: string
  latitude: string
  longitude: string
}

export function normalizeLookupCity(city: string): string {
  let normalizedCity = normalizeLocationInput(city)
  const spellingMap: { [key: string]: string } = {
    'kelang': 'klang',
    'kelong': 'klang',
    'pulau pinang': 'george town',
    'penang': 'george town',
    'malacca': 'melaka',
    'melacca': 'melaka',
    'johore': 'johor',
    'johore bahru': 'johor bahru',
    'seremban2': 'seremban',
    'seremban 2': 'seremban',
    'puchong jaya': 'puchong',
    'setia alam': 'shah alam',
    'setia city': 'shah alam'
  }
  if (spellingMap[normalizedCity]) {
    console.log(`📍 Spelling correction: "${normalizedCity}" → "${spellingMap[normalizedCity]}"`)
    normalizedCity = spellingMap[normalizedCity]
  }
  return normalizedCity
}

export async function getMalaysiaLocationCandidates(city: string): Promise<MalaysiaLocationRow[]> {
  const normalizedCity = normalizeLookupCity(city)
  if (!normalizedCity) return []

  // Step 1: Exact name match
  let { data, error } = await supabase
    .from('malaysia_locations')
    .select('name, state, latitude, longitude')
    .ilike('name', normalizedCity)
    .limit(20)

  if (error) {
    console.error('❌ malaysia_locations exact lookup error:', error)
    return []
  }

  // Step 2: Fuzzy name match
  if (!data || data.length === 0) {
    const pattern = `%${normalizedCity.split(/\s+/).filter(Boolean).join('%')}%`
    const fuzzy = await supabase
      .from('malaysia_locations')
      .select('name, state, latitude, longitude')
      .ilike('name', pattern)
      .limit(30)

    if (fuzzy.error) {
      console.error('❌ malaysia_locations fuzzy lookup error:', fuzzy.error)
    } else {
      data = fuzzy.data || []
    }
  }

  // Step 3: Alias-based fallback — search the aliases array column
  if (!data || data.length === 0) {
    console.log(`📍 Name lookup failed for "${normalizedCity}", trying aliases...`)
    const aliasResult = await supabase
      .from('malaysia_locations')
      .select('name, state, latitude, longitude')
      .contains('aliases', [normalizedCity])
      .limit(20)

    if (aliasResult.error) {
      console.error('❌ malaysia_locations alias lookup error:', aliasResult.error)
    } else if (aliasResult.data && aliasResult.data.length > 0) {
      console.log(`📍 Alias match found: "${normalizedCity}" → ${aliasResult.data.map(r => r.name).join(', ')}`)
      data = aliasResult.data
    }
  }

  const dedup = new Map<string, MalaysiaLocationRow>()
  for (const row of (data || []) as MalaysiaLocationRow[]) {
    dedup.set(`${normalizeLooseText(row.name)}::${normalizeLooseText(row.state)}`, row)
  }
  return Array.from(dedup.values())
}

export async function lookupMalaysiaLocation(city: string, state?: string): Promise<LocationResolveResult | null> {
  try {
    const candidates = await getMalaysiaLocationCandidates(city)
    if (candidates.length === 0) {
      console.log(`📍 DB Lookup: "${city}" not found in malaysia_locations table`)
      return null
    }

    let filtered = candidates
    if (state) {
      const normalizedState = normalizeLooseText(normalizeStateAlias(state))
      filtered = filtered.filter((c) => normalizeLooseText(c.state).includes(normalizedState))
    }

    if (filtered.length === 0) {
      return null
    }

    const uniqueStates = [...new Set(filtered.map((c) => c.state))]
    if (uniqueStates.length === 1) {
      const picked = filtered[0]
      return {
        lat: parseFloat(picked.latitude),
        lng: parseFloat(picked.longitude),
        state: picked.state,
        city: picked.name
      }
    }

    // Not auto-resolvable yet: return ambiguity signal for caller to clarify.
    return {
      lat: NaN,
      lng: NaN,
      state: '',
      ambiguous_states: uniqueStates
    }
  } catch (error) {
    console.error('❌ malaysia_locations lookup exception:', error)
    return null
  }
}

export async function geocodeUserLocation(user: User): Promise<{ lat: number | null, lng: number | null }> {
  const locationText = [user.location_city, user.location_state].filter(Boolean).join(', ')
  if (!locationText) return { lat: null, lng: null }

  console.log(`🗺️ Geocoding location for returning user: "${locationText}"`)

  try {
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a geocoding assistant for Malaysia. Given a location name, return ONLY a JSON object with lat and lng coordinates. Be accurate for Malaysian locations.

Example response: {"lat": 3.1390, "lng": 101.6869}

If you cannot determine the location, return: {"lat": null, "lng": null}`
          },
          {
            role: 'user',
            content: `Geocode this Malaysian location: "${locationText}"`
          }
        ],
        temperature: 0
      })
    })

    const gptData = await gptResponse.json()
    const content = gptData.choices?.[0]?.message?.content?.trim() || '{}'
    const coords = JSON.parse(content)

    if (coords.lat && coords.lng) {
      console.log(`🗺️ Geocoded: ${locationText} → (${coords.lat}, ${coords.lng})`)

      // Save coordinates to DB for future use
      await supabase.from('applicants').update({
        latitude: coords.lat,
        longitude: coords.lng,
        updated_at: new Date().toISOString()
      }).eq('id', user.id)

      return { lat: coords.lat, lng: coords.lng }
    }
  } catch (error) {
    console.error('🗺️ Geocoding error:', error)
  }

  return { lat: null, lng: null }
}
