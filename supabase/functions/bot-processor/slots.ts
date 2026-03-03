// slots.ts — Slot memory system for anti-overwrite protection of profile fields

import { normalizeLooseText } from './helpers.ts'
import type { User, ExtractedInfo, SlotKey, SlotMemory } from './types.ts'

export function buildSlot(value: string | number | null | undefined, confidence = 0.6): SlotMemory {
  return {
    value: value ?? null,
    confidence: value != null ? confidence : 0,
    locked: value != null && confidence >= 0.8,
    seen_count: value != null ? 1 : 0
  }
}

export function normalizeStateAlias(state: string): string {
  const lower = normalizeLooseText(state)
  const map: Record<string, string> = {
    'n9': 'Negeri Sembilan',
    'ns': 'Negeri Sembilan',
    'kl': 'Kuala Lumpur',
    'wp kl': 'Kuala Lumpur',
    'melacca': 'Melaka'
  }
  return map[lower] || state
}

export function normalizeLocationInput(raw: string): string {
  let text = normalizeLooseText(raw)
  const cleanupPatterns = [
    /^saya\s+duduk\s+di\s+/i,
    /^saya\s+duduk\s+/i,
    /^duduk\s+di\s+/i,
    /^duduk\s+/i,
    /^saya\s+di\s+/i,
    /^di\s+area\s+/i,
    /^area\s+/i,
    /^kat\s+/i,
    /^dekat\s+/i,
    /^lokasi\s*[:=]?\s*/i,
    /^location\s*[:=]?\s*/i,
    /^kg\s+/i,
    /^kpg\s+/i
  ]

  for (const pattern of cleanupPatterns) {
    text = text.replace(pattern, '')
  }

  text = text.replace(/\bn9\b/gi, 'negeri sembilan')
  text = text.replace(/\bns\b/gi, 'negeri sembilan')
  return text.trim()
}

export function isLikelyLocationLikeText(text: string): boolean {
  const lower = normalizeLooseText(text)
  return /\b(duduk|area|kg|kampung|jalan|jln|taman|bandar|state|negeri|selangor|johor|melaka|perak|kedah|pahang|sabah|sarawak|kl|n9)\b/i.test(lower)
}

export function isLikelyValidName(name: string): boolean {
  const candidate = normalizeLooseText(name)
  if (!candidate || candidate.length < 2 || candidate.length > 40) return false
  if (!/^[a-zA-Z\s.'/-]+$/.test(name)) return false
  if (isLikelyLocationLikeText(candidate)) return false

  // Reject names with more than 5 words (likely a phrase/sentence, not a name)
  const words = candidate.split(/\s+/)
  if (words.length > 5) return false

  // Single-word blocked list: commands, greetings, common Malay/English function words
  const blocked = new Set([
    // Commands & acknowledgements
    'lagi', 'more', 'semula', 'restart', 'ok', 'okay', 'yes', 'no', 'tak', 'tidak',
    'rumah', 'scam', 'test', 'testing', 'job', 'kerja', 'find', 'cari', 'help', 'tolong',
    // Greetings
    'hello', 'hi', 'hey', 'assalamualaikum', 'salam', 'selamat', 'pagi', 'petang', 'malam',
    'good', 'morning', 'afternoon', 'evening',
    // Question words / common function words
    'apa', 'ni', 'nak', 'mana', 'kenapa', 'boleh', 'ada', 'bila', 'siapa', 'macam',
    'what', 'how', 'why', 'when', 'where', 'who', 'which',
    // Filler / noise
    'hmm', 'huh', 'hah', 'eh', 'oh', 'start', 'mula', 'done', 'habis', 'stop',
    'please', 'sila', 'terima', 'kasih', 'thanks', 'thank', 'sorry', 'maaf'
  ])
  if (blocked.has(candidate)) return false

  // Multi-word rejection: if ALL words are common Malay/English function words, reject
  const functionWords = new Set([
    'saya', 'nak', 'tak', 'ada', 'ini', 'itu', 'yang', 'di', 'ke', 'dan', 'atau', 'dengan',
    'untuk', 'dari', 'boleh', 'sudah', 'belum', 'lagi', 'juga', 'apa', 'mana', 'ni', 'tu',
    'i', 'a', 'the', 'is', 'am', 'are', 'to', 'in', 'on', 'of', 'for', 'and', 'or', 'but',
    'it', 'this', 'that', 'not', 'do', 'can', 'will', 'my', 'me', 'you', 'your', 'we', 'they',
    'have', 'has', 'had', 'been', 'was', 'were', 'be', 'been', 'being', 'what', 'how', 'why',
    'no', 'yes', 'ok', 'so', 'if', 'just', 'want', 'need', 'job', 'work', 'kerja', 'part', 'time',
    'ke', 'ka', 'la', 'lah', 'je', 'ja', 'kot', 'kan', 'eh', 'ah'
  ])
  if (words.length >= 2 && words.every(w => functionWords.has(w))) return false

  return true
}

export function isStructuredProfileMessage(message: string, extracted: ExtractedInfo): boolean {
  let signalCount = 0
  if (extracted.name) signalCount++
  if (extracted.age) signalCount++
  if (extracted.gender) signalCount++
  if (extracted.city || extracted.state) signalCount++
  const hasSeparators = /[,./|:\n-]/.test(message)
  return signalCount >= 3 || (signalCount >= 2 && hasSeparators)
}

export function constrainExtractionToMissingSlot(extracted: ExtractedInfo, onlyMissing: string, message: string): ExtractedInfo {
  if (isStructuredProfileMessage(message, extracted)) return extracted

  if (onlyMissing === 'location') {
    return {
      ...extracted,
      name: null,
      age: null,
      gender: null
    }
  }

  if (onlyMissing === 'name') {
    return { ...extracted, age: null, gender: null, city: null, state: null, lat: null, lng: null }
  }

  if (onlyMissing === 'age') {
    return { ...extracted, name: null, gender: null, city: null, state: null, lat: null, lng: null }
  }

  if (onlyMissing === 'gender') {
    return { ...extracted, name: null, age: null, city: null, state: null, lat: null, lng: null }
  }

  return extracted
}

export function hasStrongCorrectionSignal(slot: SlotKey, message: string): boolean {
  const lower = normalizeLooseText(message)
  const signals: Record<SlotKey, RegExp[]> = {
    name: [/\b(nama\s+saya|my name is|name is|nama)\b/i],
    age: [/\b(umur|age|tahun|years? old)\b/i],
    gender: [/\b(jantina|gender|lelaki|perempuan|male|female)\b/i],
    location: [/\b(duduk|lokasi|location|kat|dekat|area|kampung|kg|city|town)\b/i]
  }
  return signals[slot].some((p) => p.test(lower))
}

export function getProfileSlots(user: User, convState: Record<string, any>): Record<SlotKey, SlotMemory> {
  const stored = convState.profile_slots || {}
  return {
    name: stored.name || buildSlot(user.full_name || null, user.full_name ? 0.9 : 0),
    age: stored.age || buildSlot(user.age || null, user.age ? 0.9 : 0),
    gender: stored.gender || buildSlot(user.gender || null, user.gender ? 0.9 : 0),
    location: stored.location || buildSlot(user.location_city || user.location_state || null, (user.location_city || user.location_state) ? 0.85 : 0)
  }
}

export function mergeSlotValue(
  slot: SlotKey,
  slots: Record<SlotKey, SlotMemory>,
  candidate: string | number | null | undefined,
  message: string
): void {
  if (candidate == null || candidate === '') return
  const entry = slots[slot]
  const normalizedCandidate = typeof candidate === 'string' ? normalizeLooseText(candidate) : `${candidate}`
  const normalizedCurrent = entry.value != null ? normalizeLooseText(String(entry.value)) : null

  if (slot === 'name' && typeof candidate === 'string' && !isLikelyValidName(candidate)) return

  if (normalizedCurrent && normalizedCurrent === normalizedCandidate) {
    entry.seen_count += 1
    entry.confidence = Math.min(1, entry.confidence + 0.08)
    if (entry.confidence >= 0.82 || entry.seen_count >= 2) entry.locked = true
    return
  }

  if (!entry.value) {
    entry.value = candidate
    entry.seen_count = 1
    entry.confidence = hasStrongCorrectionSignal(slot, message) ? 0.86 : 0.72
    entry.locked = entry.confidence >= 0.85
    return
  }

  // Existing value present: only replace if unlocked or user gives strong correction/structured profile.
  const structuredSignal = /[,./|:\n-]/.test(message) && message.trim().split(/\s+/).length >= 4
  if (!entry.locked || hasStrongCorrectionSignal(slot, message) || structuredSignal) {
    entry.value = candidate
    entry.seen_count = 1
    entry.confidence = hasStrongCorrectionSignal(slot, message) ? 0.88 : (structuredSignal ? 0.8 : Math.max(0.65, entry.confidence - 0.1))
    entry.locked = entry.confidence >= 0.85
  }
}

export function applySlotsToUser(user: User, slots: Record<SlotKey, SlotMemory>, extracted: ExtractedInfo): User {
  const next: User = { ...user }
  if (slots.name.value && typeof slots.name.value === 'string') next.full_name = slots.name.value.toUpperCase()
  if (slots.age.value && typeof slots.age.value === 'number') next.age = slots.age.value
  if (slots.gender.value && typeof slots.gender.value === 'string') next.gender = slots.gender.value

  // Location slot uses parsed location fields to keep city/state granularity.
  if (extracted.city) next.location_city = extracted.city
  if (extracted.state) next.location_state = normalizeStateAlias(extracted.state)
  if (extracted.lat) next.latitude = extracted.lat
  if (extracted.lng) next.longitude = extracted.lng

  // Fallback if extracted location missing but slot exists.
  if (!next.location_city && !next.location_state && typeof slots.location.value === 'string') {
    next.location_city = slots.location.value
  }
  return next
}
