import { supabase } from './config.ts'
import { getText, getEscalationFooter } from './helpers.ts'
import type { User, MatchedJob } from './types.ts'
import { calculateDistance, geocodeUserLocation } from './location.ts'
import { getUserJobSelections } from './job-selections.ts'

// ============================================
// EXTRACT JOB NUMBER (Running numbers)
// Now handles natural phrasing: "nombor 1", "N0 3", "saya pilih 2", etc.
// ============================================
export function extractJobNumber(message: string, maxJobs: number): number | null {
  const lower = message.toLowerCase().trim()

  // Try direct number (bare "1", "2", etc.)
  const directNum = parseInt(lower)
  if (!isNaN(directNum) && directNum >= 1 && directNum <= maxJobs && /^\d+$/.test(lower)) {
    return directNum
  }

  // Natural phrasing patterns: "nombor 1", "no 1", "num 1", "N0 3", "no. 2"
  const phrasePatterns = [
    /\b(?:nombor|nomber|number|num|no\.?|n[o0])\s*(\d+)/i,
    /\b(?:saya\s+(?:nak|pilih|mohon|mahu|mau|choose|pick|want|ingin\s+mohon))\s+(?:(?:nombor|nomber|number|num|no\.?|n[o0])\s*)?(\d+)/i,
    /\b(?:pilih|pick|choose|select)\s+(?:(?:nombor|nomber|number|num|no\.?|n[o0])\s*)?(\d+)/i,
    /^(\d+)\s*(?:tu|itu|je|la|lah|please|pls)$/i,
  ]

  for (const pattern of phrasePatterns) {
    const match = lower.match(pattern)
    if (match) {
      const num = parseInt(match[1])
      if (num >= 1 && num <= maxJobs) return num
    }
  }

  // Range detection: "1-3" or "1 sampai 3" → return null (ambiguous, let NLU handle)
  if (/\d+\s*[-–]\s*\d+/.test(lower) || /\d+\s*sampai\s*\d+/i.test(lower)) {
    return null
  }

  // Try ordinals
  const ordinals: Record<string, number> = {
    'first': 1, 'pertama': 1, 'satu': 1, '1st': 1, '第一': 1,
    'second': 2, 'kedua': 2, 'dua': 2, '2nd': 2, '第二': 2,
    'third': 3, 'ketiga': 3, 'tiga': 3, '3rd': 3, '第三': 3,
    'fourth': 4, 'keempat': 4, 'empat': 4, '4th': 4, '第四': 4,
    'fifth': 5, 'kelima': 5, 'lima': 5, '5th': 5, '第五': 5
  }

  for (const [word, num] of Object.entries(ordinals)) {
    if (lower.includes(word) && num <= maxJobs) {
      return num
    }
  }

  return null
}

// ============================================
// CHECK FOR "MORE" COMMAND
// ============================================
export function isMoreCommand(message: string): boolean {
  const lower = message.toLowerCase().trim()
  const moreWords = ['more', 'lagi', '更多', 'next', 'seterusnya', 'lain']
  return moreWords.includes(lower) || moreWords.some(w => lower.startsWith(w))
}

// ============================================
// JOB MATCHING - SIMPLIFIED
// ============================================
export async function findAndPresentJobsConversational(user: User, radiusKm: number = 10): Promise<{ message: string, jobs: MatchedJob[], noJobsAtRadius?: number, allScoredJobs?: Array<{ jobId: string, distance: number }> }> {
  const lang = user.preferred_language || 'ms'

  // Check if user needs geocoding (has location but no coordinates)
  if ((user.location_city || user.location_state) && (!user.latitude || !user.longitude)) {
    console.log(`📍 User has location but no coordinates, geocoding...`)
    const coords = await geocodeUserLocation(user)
    if (coords.lat && coords.lng) {
      user.latitude = coords.lat
      user.longitude = coords.lng
    }
  }

  // Only show non-expired jobs
  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('jobs')
    .select('*')
    .gte('expire_by', today)
    .or('status.eq.open,status.eq.active,status.is.null')

  if (user.gender) {
    query = query.or(`gender_requirement.eq.any,gender_requirement.eq.${user.gender}`)
  }

  if (user.age) {
    query = query.lte('min_age', user.age).gte('max_age', user.age)
  }

  const { data: allJobs, error } = await query.limit(50)

  if (error) {
    console.error('Job query error:', error)
    return {
      message: getText(lang, {
        ms: "Alamak ada masalah nak cari kerja. Cuba lagi sekejap ye?",
        en: "Oops there's an issue finding jobs. Try again in a bit?",
        zh: "哎呀，找工作时出了问题。稍后再试？"
      }),
      jobs: []
    }
  }

  if (!allJobs || allJobs.length === 0) {
    return {
      message: getText(lang, {
        ms: `Hmm takde kerja yang match sekarang. Cuba check balik dalam beberapa hari ye.`,
        en: `Hmm no jobs match right now. Try checking again in a few days.`,
        zh: `嗯，目前没有匹配的工作。过几天再来看看。`
      }) + getEscalationFooter(lang),
      jobs: []
    }
  }

  // Fetch previously selected job IDs (for marking, not filtering)
  const previousSelections = await getUserJobSelections(user.id, 100)
  const selectedJobIds = new Set(previousSelections.map(s => s.job_id))
  console.log(`📋 User has previously selected ${selectedJobIds.size} jobs (will still show them)`)

  // DON'T filter out previously selected jobs - user wants to see them again
  const availableJobs = allJobs

  // ============================================
  // DISTANCE-BASED JOB MATCHING (radius filter)
  // ============================================
  const scoredJobs = availableJobs.map(job => {
    let distance = Infinity

    if (user.latitude && user.longitude && job.latitude && job.longitude) {
      distance = calculateDistance(user.latitude, user.longitude, job.latitude, job.longitude)
    } else if (job.location_city) {
      if (user.location_city && job.location_city?.toLowerCase() === user.location_city.toLowerCase()) {
        distance = 0
      } else if (user.location_state && job.location_state?.toLowerCase() === user.location_state.toLowerCase()) {
        distance = 50
      } else {
        distance = 500
      }
    }

    return { job, distance }
  })

  // Build lightweight scored jobs array for state storage (only finite distances)
  const allScoredJobs = scoredJobs
    .filter(s => s.distance < Infinity)
    .map(s => ({ jobId: s.job.id, distance: Math.round(s.distance * 10) / 10 }))

  // Filter to only jobs within the given radius
  const nearbyJobs = scoredJobs.filter(s => s.distance <= radiusKm)
  console.log(`📍 Jobs within ${radiusKm}km: ${nearbyJobs.length} of ${scoredJobs.length} total`)

  // If no jobs within radius, return with expansion info
  if (nearbyJobs.length === 0) {
    const locationText = [user.location_city, user.location_state].filter(Boolean).join(', ')
    const nextRadius = radiusKm < 20 ? 20 : radiusKm < 50 ? 50 : null

    if (nextRadius) {
      const askExpandMessage = radiusKm < 20
        ? getText(lang, {
            ms: `Maaf, tiada kerja dalam radius ${radiusKm}km dari ${locationText}.\n\nNak Kak Ani cari dalam radius ${nextRadius}km?\n\nBalas 'ya' atau 'tidak'.`,
            en: `Sorry, no jobs within ${radiusKm}km of ${locationText}.\n\nWould you like to expand the search to ${nextRadius}km?\n\nReply 'yes' or 'no'.`,
            zh: `抱歉，${locationText}${radiusKm}公里范围内没有工作。\n\n要扩大到${nextRadius}公里搜索吗？\n\n回复"是"或"不是"。`
          })
        : getText(lang, {
            ms: `Masih takde kerja dalam ${radiusKm}km. Nak cuba cari dalam ${nextRadius}km?\n\nBalas 'ya' atau 'tidak'.`,
            en: `Still no jobs within ${radiusKm}km. Want to try ${nextRadius}km?\n\nReply 'yes' or 'no'.`,
            zh: `${radiusKm}公里内还是没有工作。要试试${nextRadius}公里吗？\n\n回复"是"或"不是"。`
          })

      return {
        message: askExpandMessage,
        jobs: [],
        noJobsAtRadius: radiusKm,
        allScoredJobs
      }
    }

    // Final tier - no more expansion
    return {
      message: getText(lang, {
        ms: `Maaf, tiada kerja dalam ${radiusKm}km dari ${locationText}.\n\nTip: Balas 'semula' untuk cari lokasi lain.`,
        en: `Sorry, no jobs within ${radiusKm}km of ${locationText}.\n\nTip: Reply 'restart' to try a different location.`,
        zh: `抱歉，${locationText}${radiusKm}公里内没有工作。\n\n提示：回复"重新开始"尝试其他位置。`
      }) + getEscalationFooter(lang),
      jobs: []
    }
  }

  nearbyJobs.sort((a, b) => a.distance - b.distance)
  const topJobs = nearbyJobs.slice(0, 20).map(s => ({
    id: s.job.id,
    title: s.job.title,
    company: s.job.company || '101Kerja Partner',
    location_city: s.job.location_city,
    location_state: s.job.location_state,
    salary_range: s.job.salary_range,
    url: s.job.url,
    industry: s.job.industry,
    distance: Math.round(s.distance),
    external_job_id: s.job.external_job_id,
    job_type: s.job.job_type,
    branch: s.job.branch
  }))

  const message = formatJobsMessage(topJobs, 0, lang)

  return { message, jobs: topJobs }
}

// ============================================
// HELPER: Build conversation state after job search
// ============================================
export function buildPostSearchState(matchResult: { jobs: MatchedJob[], noJobsAtRadius?: number, allScoredJobs?: Array<{ jobId: string, distance: number }> }): Record<string, any> {
  if (matchResult.noJobsAtRadius) {
    return {
      expand_search_pending: true,
      current_radius: matchResult.noJobsAtRadius,
      scored_jobs: matchResult.allScoredJobs || []
    }
  }
  return {
    matched_jobs: matchResult.jobs,
    current_job_index: 0
  }
}

// ============================================
// FORMAT JOBS MESSAGE (Running numbers)
// ============================================
export function formatJobsMessage(jobs: MatchedJob[], startIndex: number, language: string): string {
  const lang = {
    ms: {
      header: "Ni kerja2 yg sesuai:",
      salary: "Gaji",
      location: "Lokasi",
      apply: "Mohon sini",
      reply: (start: number, end: number, hasMore: boolean) =>
        hasMore
          ? `Balas nombor (${start}-${end}) nak mohon, atau 'lagi' untuk lebih banyak.`
          : `Balas nombor (${start}-${end}) nak mohon, atau 'semula' nak cari lagi.`
    },
    en: {
      header: "Here are matching jobs:",
      salary: "Salary",
      location: "Location",
      apply: "Apply here",
      reply: (start: number, end: number, hasMore: boolean) =>
        hasMore
          ? `Reply with number (${start}-${end}) to apply, or 'more' for more options.`
          : `Reply with number (${start}-${end}) to apply, or 'restart' to search again.`
    },
    zh: {
      header: "以下是符合条件的工作：",
      salary: "薪资",
      location: "地点",
      apply: "在此申请",
      reply: (start: number, end: number, hasMore: boolean) =>
        hasMore
          ? `回复数字（${start}-${end}）申请，或「更多」查看更多。`
          : `回复数字（${start}-${end}）申请，或「重新开始」再次搜索。`
    }
  }

  const l = lang[language as keyof typeof lang] || lang.ms
  const displayJobs = jobs.slice(startIndex, startIndex + 3)
  const hasMore = jobs.length > startIndex + 3

  // Running numbers
  const firstJobNumber = startIndex + 1
  const lastJobNumber = startIndex + displayJobs.length

  let message = `${l.header}\n\n`

  displayJobs.forEach((job, index) => {
    const jobNumber = startIndex + index + 1 // Running number
    const location = [job.location_city, job.location_state].filter(Boolean).join(', ') || 'Flexible'
    const salary = job.salary_range || getText(language, { ms: 'Gaji negotiate', en: 'Negotiable', zh: '面议' })
    const applyUrl = job.url || `https://101kerja.com/job/${job.id}`

    const displayTitle = job.external_job_id ? `${job.title} (${job.external_job_id})` : job.title
    message += `*${jobNumber}. ${displayTitle}*\n`
    message += `🏢 ${job.company}\n`
    if ((job as any).branch) {
      message += `📍 Branch: ${(job as any).branch}\n`
    }
    message += `📍 ${l.location}: ${location}\n`
    message += `💰 ${l.salary}: ${salary}\n`
    if (job.job_type) {
      const typeLabel = getText(language, { ms: 'Jenis', en: 'Type', zh: '类型' })
      message += `📋 ${typeLabel}: ${job.job_type}\n`
    }
    message += `\n`
  })

  message += l.reply(firstJobNumber, lastJobNumber, hasMore)

  return message
}
