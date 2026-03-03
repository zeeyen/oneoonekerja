import { OPENAI_API_KEY } from './config.ts'
import { normalizeLooseText, getText } from './helpers.ts'
import { normalizeLocationInput, normalizeStateAlias } from './slots.ts'
import { lookupMalaysiaLocation } from './location.ts'
import type { ExtractedInfo } from './types.ts'

export async function extractAllInfo(message: string, lang: string): Promise<ExtractedInfo> {
  // First try rule-based extraction for quick wins
  const ruleBased = extractInfoRuleBased(message)

  // Use GPT for smarter extraction + geocoding
  let gptResult: ExtractedInfo = { name: null, age: null, gender: null, city: null, state: null, lat: null, lng: null }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Extract user information from the message and geocode the location. Return JSON only, no other text.

Expected fields:
- name: full name (string or null)
- age: age in years (number or null) - Convert Malay number words: "tiga puluh"=30, "dua puluh lima"=25
- gender: "male" or "female" or null
- city: city/town/village name - EXPAND abbreviations to full name (string or null)
- state: Malaysian state name (string or null)
- lat: latitude coordinate (number or null) - MUST provide if location is UNAMBIGUOUS
- lng: longitude coordinate (number or null) - MUST provide if location is UNAMBIGUOUS
- ambiguous: boolean (true if location name exists in MULTIPLE states/areas)
- possible_states: array of state names where this location exists (only if ambiguous=true)

AMBIGUOUS LOCATION DETECTION:
If a location name exists in multiple Malaysian states, set ambiguous=true and list the states.
Common ambiguous names:
- "Taman Botani" → exists in Selangor, Johor, Penang, etc.
- "Taman Melati" → exists in multiple states
- "Bandar Baru" → very common name across Malaysia
- "Taman Desa" → exists in KL, Selangor, Johor
- Generic "Taman" names without state → often ambiguous

If user provides BOTH city AND state (e.g., "Taman Botani, Selangor"), it's NOT ambiguous.
If user provides only a generic name without state, mark as ambiguous and DO NOT provide lat/lng.

IMPORTANT - Malaysian Location Abbreviations (MUST expand):
- Bdr/Bndr = Bandar (e.g., "Bdr Sri D'sara" = "Bandar Sri Damansara")
- D'sara/Dsara/Dmnsra = Damansara
- Sg/Sgi = Sungai (e.g., "Sg Buloh" = "Sungai Buloh")
- Tmn = Taman
- Kpg/Kg = Kampung
- Jln/Jl = Jalan
- Bt = Bukit
- Tj = Tanjung
- P/Klang = Port Klang
- S.Alam/SA = Shah Alam
- PJ = Petaling Jaya
- JB = Johor Bahru
- KL = Kuala Lumpur
- KK = Kota Kinabalu
- KB = Kota Bharu

Malay number words:
- satu=1, dua=2, tiga=3, empat=4, lima=5, enam=6, tujuh=7, lapan=8, sembilan=9, sepuluh=10
- dua puluh=20, tiga puluh/puloh=30, empat puluh=40, lima puluh=50
- Compound: "dua puluh lima"=25, "tiga puluh dua"=32

Malaysian locations with coordinates:

SELANGOR & KL:
- Kuala Lumpur/KL (3.1390, 101.6869)
- Petaling Jaya/PJ (3.1073, 101.6067)
- Shah Alam/S.Alam (3.0733, 101.5185)
- Klang (3.0449, 101.4455)
- Port Klang/P.Klang (3.0000, 101.3833)
- Subang Jaya (3.0565, 101.5851)
- Puchong (3.0443, 101.6229)
- Kajang (2.9927, 101.7909)
- Bangi (2.9284, 101.7775)
- Rawang (3.3214, 101.5767)
- Sungai Buloh/Sg Buloh (3.2047, 101.5819)
- Bandar Sri Damansara (3.1847, 101.5944)
- Cheras (3.1073, 101.7256)
- Ampang (3.1500, 101.7600)
- Cyberjaya (2.9213, 101.6559)
- Putrajaya (2.9264, 101.6964)

JOHOR:
- Johor Bahru/JB (1.4927, 103.7414)
- Muar (2.0442, 102.5689)
- Batu Pahat/BP (1.8548, 102.9325)
- Kluang (2.0251, 103.3328)
- Segamat (2.5149, 102.8158)
- Pontian (1.4867, 103.3894)
- Kulai (1.6564, 103.6017)
- Pasir Gudang (1.4728, 103.9053)
- Iskandar Puteri (1.4253, 103.6478)
- Tangkak (2.2667, 102.5456)
- Mersing (2.4311, 103.8408)
- Sungai Abong (2.0500, 102.5833)

NEGERI SEMBILAN:
- Seremban (2.7297, 101.9381)
- Port Dickson/PD (2.5228, 101.7964)
- Nilai (2.8167, 101.8000)

MELAKA:
- Melaka/Malacca (2.1896, 102.2501)
- Alor Gajah (2.3808, 102.2083)
- Jasin (2.3167, 102.4333)

PERAK:
- Ipoh (4.5975, 101.0901)
- Taiping (4.8500, 100.7333)
- Teluk Intan (4.0333, 101.0167)
- Sitiawan (4.2167, 100.7000)
- Lumut (4.2333, 100.6167)
- Kampar (4.3000, 101.1500)

PENANG:
- George Town/Penang (5.4141, 100.3288)
- Butterworth (5.4200, 100.3833)
- Bukit Mertajam/BM (5.3631, 100.4628)
- Nibong Tebal (5.1667, 100.4833)

KEDAH:
- Alor Setar (6.1167, 100.3667)
- Sungai Petani/SP (5.6500, 100.4833)
- Kulim (5.3667, 100.5500)
- Langkawi (6.3500, 99.8000)

PAHANG:
- Kuantan (3.8167, 103.3333)
- Temerloh (3.4500, 102.4167)
- Bentong (3.5167, 101.9083)
- Raub (3.7833, 101.8500)
- Cameron Highlands (4.4722, 101.3786)

TERENGGANU:
- Kuala Terengganu/KT (5.3117, 103.1324)
- Kemaman (4.2333, 103.4167)
- Dungun (4.7667, 103.4167)

KELANTAN:
- Kota Bharu/KB (6.1256, 102.2386)
- Pasir Mas (6.0500, 102.1333)
- Tanah Merah (5.8000, 102.1500)

SABAH:
- Kota Kinabalu/KK (5.9804, 116.0735)
- Sandakan (5.8394, 118.1172)
- Tawau (4.2500, 117.8833)

SARAWAK:
- Kuching (1.5535, 110.3593)
- Miri (4.3995, 113.9914)
- Sibu (2.3000, 111.8167)
- Bintulu (3.1667, 113.0333)

Gender keywords:
- Male: lelaki, laki, laki-laki, jantan, male, man, boy, 男
- Female: perempuan, pompuan, wanita, female, woman, girl, 女

For ANY Malaysian location, provide accurate lat/lng coordinates. If location has abbreviations, EXPAND them first.
Valid Malaysia coordinates: lat 0.8-7.4, lng 99.6-119.3

Examples:
"Ahmad, 25, lelaki, KL" → {"name":"Ahmad","age":25,"gender":"male","city":"Kuala Lumpur","state":"Kuala Lumpur","lat":3.139,"lng":101.6869,"ambiguous":false}
"Siti, 30, jantan, Bdr Sri D'sara" → {"name":"Siti","age":30,"gender":"male","city":"Bandar Sri Damansara","state":"Selangor","lat":3.1847,"lng":101.5944,"ambiguous":false}
"Ali, 28, male, Sg Buloh" → {"name":"Ali","age":28,"gender":"male","city":"Sungai Buloh","state":"Selangor","lat":3.2047,"lng":101.5819,"ambiguous":false}
"Mei, perempuan, 25, Taman Botani" → {"name":"Mei","age":25,"gender":"female","city":"Taman Botani","state":null,"lat":null,"lng":null,"ambiguous":true,"possible_states":["Selangor","Johor","Penang","Negeri Sembilan"]}
"Mei, perempuan, 25, Taman Botani Selangor" → {"name":"Mei","age":25,"gender":"female","city":"Taman Botani","state":"Selangor","lat":3.0833,"lng":101.5333,"ambiguous":false}`
          },
          { role: 'user', content: message }
        ],
        max_tokens: 200,
        temperature: 0
      })
    })

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content?.trim() || '{}'

    // Parse JSON from GPT response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      gptResult = {
        name: parsed.name || null,
        age: parsed.age || null,
        gender: parsed.gender || null,
        city: parsed.city || null,
        state: parsed.state || null,
        lat: parsed.lat || null,
        lng: parsed.lng || null,
        ambiguous: parsed.ambiguous || false,
        possible_states: parsed.possible_states || undefined
      }
      console.log(`📍 GPT extracted: ${gptResult.city}, ${gptResult.state} (${gptResult.lat}, ${gptResult.lng}) ambiguous=${gptResult.ambiguous}`)
    }
  } catch (error) {
    console.error('GPT extraction error:', error)
  }

  // Merge rule-based and GPT results
  let merged: ExtractedInfo = {
    name: gptResult.name || ruleBased.name,
    age: gptResult.age || ruleBased.age,
    gender: gptResult.gender || ruleBased.gender,
    city: gptResult.city || ruleBased.city,
    state: gptResult.state || ruleBased.state,
    lat: gptResult.lat,
    lng: gptResult.lng,
    ambiguous: gptResult.ambiguous,
    possible_states: gptResult.possible_states
  }

  // HYBRID GEOCODING: Try malaysia_locations table first, then fall back to GPT
  if (merged.city && !merged.ambiguous) {
    const dbLookup = await lookupMalaysiaLocation(merged.city, merged.state || undefined)
    if (dbLookup) {
      if (Number.isFinite(dbLookup.lat) && Number.isFinite(dbLookup.lng)) {
        console.log(`✅ Using DB coordinates for "${merged.city}": (${dbLookup.lat}, ${dbLookup.lng})`)
        merged.lat = dbLookup.lat
        merged.lng = dbLookup.lng
        if (!merged.state && dbLookup.state) merged.state = dbLookup.state
        if (dbLookup.city) merged.city = dbLookup.city
        merged.ambiguous = false
        merged.possible_states = undefined
      } else if (dbLookup.ambiguous_states && dbLookup.ambiguous_states.length > 1) {
        // Keep conversation deterministic: mark ambiguity only when >1 state remains.
        merged.ambiguous = true
        merged.possible_states = dbLookup.ambiguous_states
        merged.lat = null
        merged.lng = null
        merged.state = null
      }
    } else if (!merged.lat || !merged.lng) {
      // DB lookup failed and GPT didn't provide coords either
      console.log(`⚠️ No coordinates found for "${merged.city}" in DB or GPT`)
    } else {
      console.log(`📍 Using GPT coordinates for "${merged.city}" (not in DB)`)
    }
  }

  return merged
}

// ============================================
// FIELD-SCOPED EXTRACTION
// ============================================
// When NLU identifies which fields are present, extract ONLY those fields.
// This prevents cross-contamination (e.g., location text → name field).

export async function extractSpecificFields(
  message: string,
  lang: string,
  fieldsNeeded: string[]
): Promise<ExtractedInfo> {
  // If all 4 fields needed, just use the full extractor
  if (fieldsNeeded.length >= 4 || fieldsNeeded.length === 0) {
    return extractAllInfo(message, lang)
  }

  // Run rule-based extraction first (free, always)
  const ruleBased = extractInfoRuleBased(message)

  // Build focused GPT prompt for only the specified fields
  const fieldDescriptions: Record<string, string> = {
    name: 'name: full name (string or null)',
    age: 'age: age in years (number or null) - Convert Malay number words: "tiga puluh"=30',
    gender: 'gender: "male" or "female" or null - Malay: lelaki=male, perempuan=female',
    location: `city: city/town name (string or null)
- state: Malaysian state name (string or null)
- lat: latitude (number or null)
- lng: longitude (number or null)
- ambiguous: boolean (true if location exists in multiple states)`
  }

  const fieldsPrompt = fieldsNeeded.map(f => fieldDescriptions[f] || '').filter(Boolean).join('\n- ')

  const nullFields: Record<string, string> = {}
  if (!fieldsNeeded.includes('name')) nullFields['name'] = 'null'
  if (!fieldsNeeded.includes('age')) nullFields['age'] = 'null'
  if (!fieldsNeeded.includes('gender')) nullFields['gender'] = 'null'
  if (!fieldsNeeded.includes('location')) {
    nullFields['city'] = 'null'
    nullFields['state'] = 'null'
    nullFields['lat'] = 'null'
    nullFields['lng'] = 'null'
  }

  let gptResult: ExtractedInfo = { name: null, age: null, gender: null, city: null, state: null, lat: null, lng: null }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Extract ONLY the following fields from the user's message. Return JSON only.

Fields to extract:
- ${fieldsPrompt}

IMPORTANT: Set these fields to null (do NOT extract them):
${Object.entries(nullFields).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Return valid JSON with all fields. For location, expand abbreviations and geocode if possible.`
          },
          { role: 'user', content: message }
        ],
        max_tokens: 150,
        temperature: 0
      })
    })

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content?.trim() || '{}'
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      gptResult = {
        name: fieldsNeeded.includes('name') ? (parsed.name || null) : null,
        age: fieldsNeeded.includes('age') ? (parsed.age ? Number(parsed.age) : null) : null,
        gender: fieldsNeeded.includes('gender') ? (parsed.gender || null) : null,
        city: fieldsNeeded.includes('location') ? (parsed.city || null) : null,
        state: fieldsNeeded.includes('location') ? (parsed.state || null) : null,
        lat: fieldsNeeded.includes('location') ? (parsed.lat || null) : null,
        lng: fieldsNeeded.includes('location') ? (parsed.lng || null) : null,
        ambiguous: fieldsNeeded.includes('location') ? parsed.ambiguous : undefined,
        possible_states: fieldsNeeded.includes('location') ? parsed.possible_states : undefined
      }
      console.log(`🎯 extractSpecificFields [${fieldsNeeded}]:`, JSON.stringify(gptResult))
    }
  } catch (error) {
    console.error('extractSpecificFields GPT error:', error)
  }

  // Merge rule-based with GPT (GPT takes precedence for requested fields only)
  const merged: ExtractedInfo = { name: null, age: null, gender: null, city: null, state: null, lat: null, lng: null }
  for (const field of fieldsNeeded) {
    if (field === 'name') merged.name = gptResult.name || ruleBased.name || null
    if (field === 'age') merged.age = gptResult.age || ruleBased.age || null
    if (field === 'gender') merged.gender = gptResult.gender || ruleBased.gender || null
    if (field === 'location') {
      merged.city = gptResult.city || ruleBased.city || null
      merged.state = gptResult.state || ruleBased.state || null
      merged.lat = gptResult.lat || ruleBased.lat || null
      merged.lng = gptResult.lng || ruleBased.lng || null
      merged.ambiguous = gptResult.ambiguous
      merged.possible_states = gptResult.possible_states
    }
  }

  // Location DB lookup for coords (same as extractAllInfo)
  if (merged.city && fieldsNeeded.includes('location')) {
    const locationText = normalizeLocationInput(merged.city)
    const dbLookup = await lookupMalaysiaLocation(locationText)
    if (dbLookup) {
      merged.city = dbLookup.city
      merged.state = dbLookup.state
      merged.lat = dbLookup.lat
      merged.lng = dbLookup.lng
      merged.ambiguous = false
    }
  }

  return merged
}

// ============================================
// RULE-BASED INFO EXTRACTION (Fallback)
// ============================================
export function extractInfoRuleBased(message: string): ExtractedInfo {
  const result: ExtractedInfo = {
    name: null,
    age: null,
    gender: null,
    city: null,
    state: null,
    lat: null,
    lng: null
  }

  const lower = message.toLowerCase()
  const trimMsg = message.trim()

  // Normalize loose separators commonly used by applicants:
  // "Arfah.29.nilai", "Ahmad/Kepong/30", "Ali|25|lelaki|KL".
  // Keep dots untouched for normal sentences unless it looks like structured segments.
  const dotCount = (trimMsg.match(/\./g) || []).length
  const looksLikeStructuredDots =
    dotCount >= 2 &&
    !/\s*\.\s*$/.test(trimMsg) &&
    !/https?:\/\//i.test(trimMsg)

  const segmentedMessage = looksLikeStructuredDots
    ? trimMsg.replace(/\./g, ',')
    : trimMsg

  const segments = segmentedMessage
    .replace(/[\n\r]+/g, ',')
    .split(/[,\|\/;]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  // Extract age - including Malay number words
  const malayNumbers: Record<string, number> = {
    'satu': 1, 'dua': 2, 'tiga': 3, 'empat': 4, 'lima': 5,
    'enam': 6, 'tujuh': 7, 'lapan': 8, 'sembilan': 9, 'sepuluh': 10,
    'sebelas': 11, 'dua belas': 12, 'tiga belas': 13, 'empat belas': 14, 'lima belas': 15,
    'enam belas': 16, 'tujuh belas': 17, 'lapan belas': 18, 'sembilan belas': 19,
    'dua puluh': 20, 'dua puloh': 20,
    'tiga puluh': 30, 'tiga puloh': 30,
    'empat puluh': 40, 'empat puloh': 40,
    'lima puluh': 50, 'lima puloh': 50,
    'enam puluh': 60, 'enam puloh': 60
  }

  // Check for compound numbers like "dua puluh lima" (25)
  const compoundMatch = lower.match(/(dua|tiga|empat|lima|enam)\s*pul[uo]h\s*(satu|dua|tiga|empat|lima|enam|tujuh|lapan|sembilan)?/i)
  if (compoundMatch) {
    const tensMap: Record<string, number> = { 'dua': 20, 'tiga': 30, 'empat': 40, 'lima': 50, 'enam': 60 }
    const unitsMap: Record<string, number> = { 'satu': 1, 'dua': 2, 'tiga': 3, 'empat': 4, 'lima': 5, 'enam': 6, 'tujuh': 7, 'lapan': 8, 'sembilan': 9 }
    const tens = tensMap[compoundMatch[1].toLowerCase()] || 0
    const units = compoundMatch[2] ? (unitsMap[compoundMatch[2].toLowerCase()] || 0) : 0
    const age = tens + units
    if (age >= 15 && age <= 80) {
      result.age = age
    }
  }

  // Check for simple Malay numbers
  if (!result.age) {
    for (const [word, num] of Object.entries(malayNumbers)) {
      if (lower.includes(word) && num >= 15 && num <= 80) {
        result.age = num
        break
      }
    }
  }

  // Standard age patterns
  if (!result.age) {
    const agePatterns = [
      /(\d{1,2})\s*(tahun|thn|th|years?|yrs?|yo|岁)/i,
      /umur\s*[:=]?\s*(\d{1,2})/i,
      /age\s*[:=]?\s*(\d{1,2})/i,
    ]
    for (const pattern of agePatterns) {
      const match = message.match(pattern)
      if (match) {
        const age = parseInt(match[1])
        if (age >= 15 && age <= 80) {
          result.age = age
          break
        }
      }
    }
  }

  // Standalone 2-digit numbers
  if (!result.age) {
    const nums = message.match(/\b(\d{2})\b/g)
    if (nums) {
      for (const num of nums) {
        const age = parseInt(num)
        if (age >= 18 && age <= 65) {
          result.age = age
          break
        }
      }
    }
  }

  // Extract gender
  const maleWords = ['lelaki', 'laki', 'laki-laki', 'jantan', 'male', 'man', 'boy', '男']
  const femaleWords = ['perempuan', 'pompuan', 'wanita', 'female', 'woman', 'girl', '女']

  for (const word of maleWords) {
    if (lower.includes(word)) {
      result.gender = 'male'
      break
    }
  }
  if (!result.gender) {
    for (const word of femaleWords) {
      if (lower.includes(word)) {
        result.gender = 'female'
        break
      }
    }
  }

  // Extract location
  const locationAliases: Array<[string, { city: string, state: string }]> = [
    ['kuala lumpur', { city: 'Kuala Lumpur', state: 'Kuala Lumpur' }],
    ['negeri sembilan', { city: 'Seremban', state: 'Negeri Sembilan' }],
    ['shah alam', { city: 'Shah Alam', state: 'Selangor' }],
    ['petaling jaya', { city: 'Petaling Jaya', state: 'Selangor' }],
    ['johor bahru', { city: 'Johor Bahru', state: 'Johor' }],
    ['kota kinabalu', { city: 'Kota Kinabalu', state: 'Sabah' }],
    ['kota bharu', { city: 'Kota Bharu', state: 'Kelantan' }],
    ['george town', { city: 'George Town', state: 'Penang' }],
    ['subang jaya', { city: 'Subang Jaya', state: 'Selangor' }],
    ['alor setar', { city: 'Alor Setar', state: 'Kedah' }],
    ['terengganu', { city: 'Kuala Terengganu', state: 'Terengganu' }],
    ['cyberjaya', { city: 'Cyberjaya', state: 'Selangor' }],
    ['putrajaya', { city: 'Putrajaya', state: 'Putrajaya' }],
    ['selangor', { city: 'Shah Alam', state: 'Selangor' }],
    ['kelantan', { city: 'Kota Bharu', state: 'Kelantan' }],
    ['sarawak', { city: 'Kuching', state: 'Sarawak' }],
    ['malacca', { city: 'Melaka', state: 'Melaka' }],
    ['penang', { city: 'George Town', state: 'Penang' }],
    ['melaka', { city: 'Melaka', state: 'Melaka' }],
    ['subang', { city: 'Subang Jaya', state: 'Selangor' }],
    ['pahang', { city: 'Kuantan', state: 'Pahang' }],
    ['perlis', { city: 'Kangar', state: 'Perlis' }],
    ['klang', { city: 'Klang', state: 'Selangor' }],
    ['kapar', { city: 'Kapar', state: 'Selangor' }],
    ['banting', { city: 'Banting', state: 'Selangor' }],
    ['nilai', { city: 'Nilai', state: 'Negeri Sembilan' }],
    ['nilai impian', { city: 'Nilai', state: 'Negeri Sembilan' }],
    ['kepong', { city: 'Kepong', state: 'Kuala Lumpur' }],
    ['jelebu', { city: 'Jelebu', state: 'Negeri Sembilan' }],
    ['jalan kebun', { city: 'Jalan Kebun', state: 'Selangor' }],
    ['puchong indah', { city: 'Puchong', state: 'Selangor' }],
    ['kedah', { city: 'Alor Setar', state: 'Kedah' }],
    ['perak', { city: 'Ipoh', state: 'Perak' }],
    ['johor', { city: 'Johor Bahru', state: 'Johor' }],
    ['sabah', { city: 'Kota Kinabalu', state: 'Sabah' }],
    ['ipoh', { city: 'Ipoh', state: 'Perak' }],
    ['meru', { city: 'Klang', state: 'Selangor' }],
    ['pj', { city: 'Petaling Jaya', state: 'Selangor' }],
    ['jb', { city: 'Johor Bahru', state: 'Johor' }],
    ['kl', { city: 'Kuala Lumpur', state: 'Kuala Lumpur' }],
    ['ns', { city: 'Seremban', state: 'Negeri Sembilan' }],
  ]

  for (const [alias, loc] of locationAliases) {
    if (alias.length <= 2) {
      const wordBoundaryRegex = new RegExp(`\\b${alias}\\b`, 'i')
      if (wordBoundaryRegex.test(lower)) {
        result.city = loc.city
        result.state = loc.state
        break
      }
    } else if (lower.includes(alias)) {
      result.city = loc.city
      result.state = loc.state
      break
    }
  }

  // Extract name
  const namePatterns = [
    /nama\s*(?:saya\s*)?(?:ialah\s*)?[:=]?\s*([A-Za-z][A-Za-z\s]{1,30})/i,
    /(?:i am|my name is|name:?)\s*([A-Za-z][A-Za-z\s]{1,30})/i,
  ]
  for (const pattern of namePatterns) {
    const match = message.match(pattern)
    if (match) {
      result.name = match[1].trim()
      break
    }
  }

  if (!result.name) {
    if (segments[0]) {
      const firstPart = segments[0]
      const notNameWords = [
        // Greetings - should not be treated as names
        'hello', 'hi', 'hai', 'hey', 'helo', 'halo', 'yo', 'oi', 'woi', 'wei',
        // Common words
        'umur', 'age', 'tahun', 'lelaki', 'laki', 'perempuan', 'male', 'female', '男', '女',
        'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'lapan', 'sembilan', 'sepuluh',
        'puluh', 'puloh',
        // Random words that aren't names
        'test', 'testing', 'ok', 'okay', 'yes', 'no', 'ya', 'tidak', 'nak', 'mau', 'want',
        'kerja', 'job', 'cari', 'find', 'help', 'tolong', 'bantuan',
        'lagi', 'more', 'semula', 'restart', 'rumah', 'scam',
        'duduk', 'area', 'lokasi', 'location', 'jalan', 'jln', 'kg', 'kampung',
        'nilai', 'kepong', 'puchong', 'klang'
      ]
      const firstWord = firstPart.split(/\s+/)[0].toLowerCase()

      if (firstPart.length >= 2 &&
          /^[a-zA-Z\s]+$/.test(firstPart) &&
          !notNameWords.includes(firstWord) &&
          !/^\d+$/.test(firstPart)) {
        result.name = firstPart
      }
    }
  }

  return result
}
