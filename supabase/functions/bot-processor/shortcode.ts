import { supabase } from './config.ts'
import { getText } from './helpers.ts'
import type { User, MatchedJob } from './types.ts'
import { formatJobsMessage } from './jobs.ts'

// ============================================
// SHORTCODE DETECTION (geo-xxxx / com-xxxx)
// ============================================
export function detectShortcode(message: string): { type: 'geo' | 'com', slug: string } | null {
  const match = message.trim().match(/^(geo|com)-(.+)$/i)
  if (!match) return null
  return { type: match[1].toLowerCase() as 'geo' | 'com', slug: match[2].toLowerCase() }
}

export function expandSlug(slug: string): string {
  // Full-word abbreviation replacements (when slug IS the abbreviation)
  const fullWordMap: Record<string, string> = {
    'pj': 'petaling jaya',
    'jb': 'johor bahru',
    'kl': 'kuala lumpur',
    'kk': 'kota kinabalu',
    'kb': 'kota bharu',
    'sa': 'shah alam',
    'pd': 'port dickson',
    'bm': 'bukit mertajam',
    'sp': 'sungai petani',
  }

  // If the entire slug is a known abbreviation, expand it
  if (fullWordMap[slug]) {
    return fullWordMap[slug]
  }

  // Prefix abbreviations - only match when followed by a clear word boundary
  // These are abbreviations that commonly prefix place names
  const prefixAbbrevs: Array<[string, string]> = [
    ['bndr', 'bandar'],
    ['bdr', 'bandar'],
    ['tmn', 'taman'],
    ['jln', 'jalan'],
    ['kpg', 'kampung'],
    ['sg', 'sungai'],
    ['bt', 'batu'],
    ['kg', 'kampung'],
    ['tj', 'tanjung'],
  ]

  // Sort by length (longest first)
  prefixAbbrevs.sort((a, b) => b[0].length - a[0].length)

  let expanded = slug

  for (const [abbr, full] of prefixAbbrevs) {
    if (expanded.startsWith(abbr) && expanded.length > abbr.length) {
      const rest = expanded.slice(abbr.length)
      // Only split if the remainder looks like a separate word
      // (i.e., not a natural continuation like "klang" after "k")
      // Heuristic: abbreviation must be at least 2 chars and the rest should be >= 3 chars
      if (abbr.length >= 2 && rest.length >= 2) {
        expanded = full + ' ' + rest
        break
      }
    }
  }

  return expanded.trim()
}

export function buildIlikePattern(searchTerm: string): string {
  // Split into words and join with % for fuzzy ILIKE matching
  const words = searchTerm.split(/\s+/).filter(w => w.length > 0)
  return `%${words.join('%')}%`
}

export async function handleShortcodeSearch(
  user: User,
  type: 'geo' | 'com',
  slug: string
): Promise<{ response: string, updatedUser: User }> {
  const lang = user.preferred_language || 'ms'
  const expanded = expandSlug(slug)
  const pattern = buildIlikePattern(expanded)

  console.log(`🔗 Shortcode: ${type}-${slug} → expanded: "${expanded}" → pattern: "${pattern}"`)

  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('jobs')
    .select('*')
    .gte('expire_by', today)

  if (type === 'geo') {
    // Search location_city, location_address, location_state
    query = query.or(`location_city.ilike.${pattern},location_address.ilike.${pattern},location_state.ilike.${pattern}`)
  } else {
    // Search company
    query = query.or(`company.ilike.${pattern}`)
  }

  const { data: jobs, error } = await query.limit(20)

  if (error) {
    console.error('Shortcode search error:', error)
    return {
      response: 'Alamak ada masalah teknikal. Cuba hantar mesej sekali lagi ye?',
      updatedUser: user
    }
  }

  if (!jobs || jobs.length === 0) {
    console.log(`🔗 No jobs found for shortcode ${type}-${slug}`)
    const hasProfile = user.full_name && user.age && user.gender

    if (hasProfile) {
      // Returning user - just tell them no jobs found, offer restart
      const firstName = user.full_name?.split(' ')[0] || ''
      const noJobsMsg = getText(lang, {
        ms: `Maaf ${firstName}, tiada kerja dijumpai untuk "${expanded}".\n\nBalas 'semula' untuk cari kerja lain.`,
        en: `Sorry ${firstName}, no jobs found for "${expanded}".\n\nReply 'restart' to search for other jobs.`,
        zh: `抱歉${firstName}，没有找到"${expanded}"的工作。\n\n回复「重新开始」搜索其他工作。`
      })
      return { response: noJobsMsg, updatedUser: user }
    } else {
      // New user - fall through to normal onboarding
      const noJobsMsg = `Maaf, tiada kerja dijumpai untuk "${expanded}".\n\nTakpe, Kak Ani boleh tolong cari kerja lain.\n\nBoleh bagitahu:\n- Nama penuh\n- Umur\n- Lelaki/Perempuan\n- Duduk mana (bandar, negeri)\n\nContoh: "Ahmad, 25, lelaki, Shah Alam Selangor"`

      await supabase.from('applicants').update({
        onboarding_status: 'in_progress',
        onboarding_step: 'collect_info',
        preferred_language: 'ms',
        conversation_state: {},
        updated_at: new Date().toISOString()
      }).eq('id', user.id)

      return {
        response: noJobsMsg,
        updatedUser: { ...user, onboarding_status: 'in_progress', onboarding_step: 'collect_info', preferred_language: 'ms', conversation_state: {} }
      }
    }
  }

  // Format matched jobs
  const matchedJobs: MatchedJob[] = jobs.map(job => ({
    id: job.id,
    title: job.title,
    company: job.company || '101Kerja Partner',
    location_city: job.location_city,
    location_state: job.location_state,
    salary_range: job.salary_range,
    url: job.url,
    industry: job.industry,
    external_job_id: job.external_job_id
  }))

  const hasProfile = user.full_name && user.age && user.gender
  const jobsMessage = formatJobsMessage(matchedJobs, 0, lang)

  const searchTypeLabel = type === 'geo'
    ? getText(lang, {
        ms: `dekat ${expanded.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
        en: `near ${expanded.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
        zh: `在${expanded.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}附近`
      })
    : getText(lang, {
        ms: `di ${expanded.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
        en: `at ${expanded.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
        zh: `在${expanded.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`
      })

  if (hasProfile) {
    // Returning user - go straight to matching, let them pick jobs
    console.log(`🔗 Returning user with profile, going straight to matching`)

    const conversationState = {
      matched_jobs: matchedJobs,
      current_job_index: 0
    }

    const firstName = user.full_name?.split(' ')[0] || ''
    const response = getText(lang, {
      ms: `Hai ${firstName}! Jumpa ${matchedJobs.length} kerja ${searchTypeLabel}:\n\n${jobsMessage}`,
      en: `Hi ${firstName}! Found ${matchedJobs.length} jobs ${searchTypeLabel}:\n\n${jobsMessage}`,
      zh: `嗨${firstName}！找到${matchedJobs.length}个工作${searchTypeLabel}：\n\n${jobsMessage}`
    })

    const updatedUser: User = {
      ...user,
      onboarding_status: 'matching',
      onboarding_step: 'viewing_jobs',
      conversation_state: conversationState
    }

    await supabase.from('applicants').update({
      onboarding_status: 'matching',
      onboarding_step: 'viewing_jobs',
      conversation_state: conversationState,
      updated_at: new Date().toISOString()
    }).eq('id', user.id)

    return { response, updatedUser }
  }

  // New user - show jobs + ask for info
  const response = `Salam! Saya Kak Ani dari 101Kerja.\n\nJumpa ${matchedJobs.length} kerja ${searchTypeLabel}:\n\n${jobsMessage}\n\n━━━━━━━━━━━━━━━━━━━━\n\nUntuk mohon, Kak Ani perlukan maklumat adik:\n- Nama penuh\n- Umur\n- Lelaki/Perempuan\n- Duduk mana (bandar, negeri)\n\nContoh: "Ahmad, 25, lelaki, Shah Alam Selangor"`

  const conversationState = {
    shortcode_jobs: matchedJobs,
    shortcode_type: type,
    current_job_index: 0
  }

  const updatedUser: User = {
    ...user,
    onboarding_status: 'in_progress',
    onboarding_step: 'collect_info',
    preferred_language: 'ms',
    conversation_state: conversationState
  }

  await supabase.from('applicants').update({
    onboarding_status: 'in_progress',
    onboarding_step: 'collect_info',
    preferred_language: 'ms',
    conversation_state: conversationState,
    updated_at: new Date().toISOString()
  }).eq('id', user.id)

  console.log(`🔗 Shortcode: Found ${matchedJobs.length} jobs, new user → collect_info with shortcode_jobs`)

  return { response, updatedUser }
}
