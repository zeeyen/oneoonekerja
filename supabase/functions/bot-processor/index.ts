// Supabase Edge Function: bot-processor (Enhanced Version v2)
// 101Kerja WhatsApp Bot powered by GPT-4o-mini
// Personality: Kak Ani - friendly kakak helping B40s find work
// ENHANCED FLOW: Language → All Info → Jobs (no confirmation step)
// Features: Running job numbers, language switch, customer service, session timeout
// Deploy: supabase functions deploy bot-processor --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!
const AGENCY_BASE_URL = Deno.env.get('AGENCY_BASE_URL') || 'https://101kerja.com/apply'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

// ============================================
// PROFANITY FILTER (English, Malay, Mandarin)
// ============================================
const PROFANITY_PATTERNS = [
  // English - common profanity
  /\b(fuck|shit|bitch|ass|damn|bastard|dick|cock|pussy|cunt|whore|slut)\b/i,

  // Malay - vulgar words
  /\b(pukimak|puki|bodoh|bangang|sial|babi|haram|lancau|celaka|sundal|jalang|kimak|cipap|pantat|tetek|cibai|kongkek|jubur|pelir|konek|butoh|taik)\b/i,

  // Malay - insulting words (commonly used in slang)
  /\b(goblok|tolol|dungu|bengap|bebal|bahlul|haprak|keparat|anjing|asu|monyet|beruk)\b/i,

  // Malay - phrase-based insults (mak/bapak kau variants)
  /\bmak\s*(kau|ko|hang|mu|engkau)\b/i,
  /\bbapak\s*(kau|ko|hang|mu|engkau)\b/i,
  /\banak\s*(haram|sundal|jalang)\b/i,

  // Malay - shortened/slang variants
  /\b(siot|cis|cit|ptuih|wtf|stfu)\b/i,

  // Mandarin pinyin
  /\b(cao|tmd|nmsl|sb|nima|bichi|shabi|tamade|guniang|diu)\b/i
]

const PROFANITY_WARNINGS = {
  ms: `Eh adik, semua chat ni direkod tau. Tolong jangan guna bahasa kasar ye. Nak cari kerja apa hari ni?`,
  en: `Please note that all conversations are recorded. Kindly avoid using inappropriate language. How can I help you find a job today?`,
  zh: `请注意，所有对话都会被记录。请不要使用不当语言。我能帮您找什么工作？`
}

function containsProfanity(message: string): boolean {
  return PROFANITY_PATTERNS.some(pattern => pattern.test(message))
}

// ============================================
// VIOLATION TRACKING & BAN SYSTEM
// ============================================
async function handleProfanityViolation(user: User, message: string): Promise<{ response: string, updatedUser: User }> {
  const lang = user.preferred_language || 'ms'
  const currentViolations = (user.violation_count || 0) + 1

  console.log(`🚨 Violation #${currentViolations} for user ${user.phone_number}`)

  let banUntil: Date | null = null
  let banReason: string | null = null
  let response: string

  // Escalating consequences
  if (currentViolations === 1) {
    // First violation: Warning
    response = getText(lang, {
      ms: `⚠️ *Amaran Pertama*\n\nEh adik, semua chat ni direkod tau. Tolong jangan guna bahasa kasar ye.\n\nKalau ulang lagi, akaun adik akan disekat.\n\nNak cari kerja apa hari ni?`,
      en: `⚠️ *First Warning*\n\nPlease note that all conversations are recorded. Kindly avoid using inappropriate language.\n\nRepeated violations will result in account suspension.\n\nHow can I help you find a job today?`,
      zh: `⚠️ *第一次警告*\n\n请注意，所有对话都会被记录。请不要使用不当语言。\n\n再次违规将导致账户被封禁。\n\n我能帮您找什么工作？`
    })
  } else if (currentViolations === 2) {
    // Second violation: Final warning
    response = getText(lang, {
      ms: `⚠️ *Amaran Terakhir*\n\nIni amaran terakhir. Sekali lagi guna bahasa tak sesuai, akaun adik akan disekat 24 jam.\n\nSila jaga pertuturan ye.`,
      en: `⚠️ *Final Warning*\n\nThis is your final warning. One more violation and your account will be suspended for 24 hours.\n\nPlease mind your language.`,
      zh: `⚠️ *最后警告*\n\n这是您的最后警告。再违规一次，您的账户将被封禁24小时。\n\n请注意您的言行。`
    })
  } else if (currentViolations === 3) {
    // Third violation: 24-hour ban
    banUntil = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    banReason = 'Penggunaan bahasa tidak sesuai (3 kali)'
    response = getText(lang, {
      ms: `🚫 *Akaun Disekat 24 Jam*\n\nAdik telah melanggar peraturan 3 kali. Akaun disekat selama 24 jam.\n\nSila cuba lagi esok.`,
      en: `🚫 *Account Suspended 24 Hours*\n\nYou have violated our guidelines 3 times. Your account is suspended for 24 hours.\n\nPlease try again tomorrow.`,
      zh: `🚫 *账户被封禁24小时*\n\n您已违规3次。您的账户被封禁24小时。\n\n请明天再试。`
    })
  } else if (currentViolations === 4) {
    // Fourth violation: 72-hour ban
    banUntil = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours
    banReason = 'Penggunaan bahasa tidak sesuai berulang kali (4 kali)'
    response = getText(lang, {
      ms: `🚫 *Akaun Disekat 72 Jam*\n\nIni kali ke-4 adik melanggar peraturan. Akaun disekat selama 3 hari.\n\nSila hubungi khidmat pelanggan jika ada pertanyaan.`,
      en: `🚫 *Account Suspended 72 Hours*\n\nThis is your 4th violation. Your account is suspended for 3 days.\n\nPlease contact customer service if you have questions.`,
      zh: `🚫 *账户被封禁72小时*\n\n这是您第4次违规。您的账户被封禁3天。\n\n如有疑问请联系客服。`
    })
  } else {
    // Fifth+ violation: 7-day ban (or permanent for repeat offenders)
    const banDays = Math.min(7 * (currentViolations - 4), 30) // Cap at 30 days
    banUntil = new Date(Date.now() + banDays * 24 * 60 * 60 * 1000)
    banReason = `Penggunaan bahasa tidak sesuai berulang kali (${currentViolations} kali)`
    response = getText(lang, {
      ms: `🚫 *Akaun Disekat ${banDays} Hari*\n\nAdik telah melanggar peraturan ${currentViolations} kali. Akaun disekat selama ${banDays} hari.\n\nHubungi khidmat pelanggan untuk rayuan.`,
      en: `🚫 *Account Suspended ${banDays} Days*\n\nYou have violated our guidelines ${currentViolations} times. Your account is suspended for ${banDays} days.\n\nContact customer service to appeal.`,
      zh: `🚫 *账户被封禁${banDays}天*\n\n您已违规${currentViolations}次。您的账户被封禁${banDays}天。\n\n请联系客服申诉。`
    })
  }

  // Update database
  const updateData: Record<string, any> = {
    violation_count: currentViolations,
    last_violation_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  if (banUntil) {
    updateData.banned_until = banUntil.toISOString()
    updateData.ban_reason = banReason
  }

  await supabase.from('applicants').update(updateData).eq('id', user.id)

  // Update user object
  const updatedUser: User = {
    ...user,
    violation_count: currentViolations,
    last_violation_at: new Date().toISOString(),
    banned_until: banUntil?.toISOString(),
    ban_reason: banReason || undefined
  }

  return { response, updatedUser }
}

// ============================================
// KAK ANI'S PERSONALITY PROMPT
// ============================================
const KAK_ANI_SYSTEM_PROMPT = `Kamu adalah "Kak Ani", pembantu WhatsApp yang mesra untuk 101Kerja - platform cari kerja untuk golongan B40 di Malaysia.

PERSONALITI KAK ANI:
- Mesra, peramah, macam kakak sebelah rumah yang suka tolong
- Guna bahasa santai tapi sopan, boleh campur sikit bahasa pasar
- Selalu beri semangat dan positif
- Faham kesusahan orang cari kerja, empati tinggi
- Panggil user "adik" atau guna nama mereka kalau dah tahu
- JANGAN guna emoji melainkan sangat perlu (max 1 per keseluruhan conversation)
- Jawapan ringkas dan padat, jangan terlalu panjang

PERATURAN PENTING:
1. JANGAN buat response panjang berjela - keep it short and sweet
2. JANGAN guna bahasa terlalu formal atau "AI-ish"
3. JANGAN sebut "saya adalah AI" atau "saya chatbot"
4. Kalau user guna English, reply in English
5. Kalau user guna Chinese, reply in Simplified Chinese
6. JANGAN guna emoji - buat natural macam manusia

ALIRAN ONBOARDING (RINGKAS - 2 langkah sahaja):
1. Sambut & tanya bahasa pilihan (BM/EN/ZH)
2. Minta SEMUA maklumat sekali: nama, umur, jantina, lokasi → terus cari kerja`

// ============================================
// HELPER FUNCTIONS
// ============================================
function getTimeBasedGreeting(): { ms: string, en: string, zh: string } {
  const now = new Date()
  const malaysiaOffset = 8 * 60
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
  const malaysiaTime = new Date(utc + (malaysiaOffset * 60000))
  const hour = malaysiaTime.getHours()

  if (hour >= 5 && hour < 12) {
    return { ms: 'Selamat pagi', en: 'Good morning', zh: '早上好' }
  } else if (hour >= 12 && hour < 18) {
    return { ms: 'Selamat petang', en: 'Good afternoon', zh: '下午好' }
  } else {
    return { ms: 'Selamat malam', en: 'Good evening', zh: '晚上好' }
  }
}

function getText(lang: string, texts: { ms: string, en: string, zh: string }): string {
  if (lang === 'zh') return texts.zh
  if (lang === 'en') return texts.en
  return texts.ms
}

// ============================================
// TYPES
// ============================================
interface User {
  id: string
  phone_number: string
  full_name?: string
  age?: number
  gender?: string
  preferred_language?: string
  location_city?: string
  location_state?: string
  latitude?: number
  longitude?: number
  onboarding_status: string
  onboarding_step?: string
  conversation_state?: Record<string, any>
  is_active?: boolean
  last_active_at?: string
  // Violation tracking
  violation_count?: number
  banned_until?: string
  ban_reason?: string
  last_violation_at?: string
}

interface ProcessRequest {
  user: User
  message: string
  messageType: string
  locationData?: any
}

interface GPTMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ExtractedInfo {
  name: string | null
  age: number | null
  gender: string | null
  city: string | null
  state: string | null
  lat: number | null
  lng: number | null
  ambiguous?: boolean  // True if location name exists in multiple states
  possible_states?: string[]  // List of states where this location exists
}

interface MatchedJob {
  id: string
  title: string
  company: string
  location_city: string
  location_state: string
  salary_range: string | null
  url: string | null
  industry?: string
  distance?: number
  external_job_id?: string
}

interface JobSelection {
  id: string
  job_id: string
  job_title: string
  company: string | null
  location_city: string | null
  location_state: string | null
  apply_url: string | null
  selected_at: string
}

// ============================================
// JOB SELECTIONS HELPER FUNCTIONS
// ============================================
async function getUserJobSelections(userId: string, limit: number = 10): Promise<JobSelection[]> {
  const { data, error } = await supabase
    .from('job_selections')
    .select('*')
    .eq('user_id', userId)
    .order('selected_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching job selections:', error)
    return []
  }

  return data || []
}

async function saveJobSelection(
  userId: string,
  job: MatchedJob,
  applyUrl: string
): Promise<void> {
  const { error } = await supabase
    .from('job_selections')
    .upsert({
      user_id: userId,
      job_id: job.id,
      job_title: job.title,
      company: job.company,
      location_city: job.location_city,
      location_state: job.location_state,
      apply_url: applyUrl,
      selected_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,job_id'
    })

  if (error) {
    console.error('Error saving job selection:', error)
  } else {
    console.log(`📋 Saved job selection: ${job.title} for user ${userId}`)
  }
}

function formatTimeAgo(dateString: string, lang: string): string {
  const now = new Date()
  const then = new Date(dateString)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) {
    return getText(lang, {
      ms: `${diffMins} minit lepas`,
      en: `${diffMins} min ago`,
      zh: `${diffMins}分钟前`
    })
  } else if (diffHours < 24) {
    return getText(lang, {
      ms: `${diffHours} jam lepas`,
      en: `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`,
      zh: `${diffHours}小时前`
    })
  } else {
    return getText(lang, {
      ms: `${diffDays} hari lepas`,
      en: `${diffDays} day${diffDays > 1 ? 's' : ''} ago`,
      zh: `${diffDays}天前`
    })
  }
}

function formatJobSelectionsMessage(selections: JobSelection[], lang: string): string {
  if (selections.length === 0) return ''

  const header = getText(lang, {
    ms: `📋 *Kerja Yang Adik Dah Pilih:*\n━━━━━━━━━━━━━━━━━━━━`,
    en: `📋 *Jobs You've Selected:*\n━━━━━━━━━━━━━━━━━━━━`,
    zh: `📋 *您已选择的工作：*\n━━━━━━━━━━━━━━━━━━━━`
  })

  const jobLines = selections.map((sel, idx) => {
    const location = [sel.location_city, sel.location_state].filter(Boolean).join(', ') || 'Flexible'
    const timeAgo = formatTimeAgo(sel.selected_at, lang)
    return `${idx + 1}. ${sel.job_title}${sel.company ? ` - ${sel.company}` : ''}\n   📍 ${location} | ⏰ ${timeAgo}\n   👉 ${sel.apply_url}`
  }).join('\n\n')

  const disclaimer = getText(lang, {
    ms: `\n━━━━━━━━━━━━━━━━━━━━\n⚠️ *PENTING:* Pilih kat chatbot ni baru langkah pertama. Adik WAJIB klik link dan daftar kat website untuk lengkapkan permohonan!`,
    en: `\n━━━━━━━━━━━━━━━━━━━━\n⚠️ *IMPORTANT:* Selecting here is just the first step. You MUST click the link and register on the website to complete your application!`,
    zh: `\n━━━━━━━━━━━━━━━━━━━━\n⚠️ *重要：* 在这里选择只是第一步。您必须点击链接并在网站上注册才能完成申请！`
  })

  return `${header}\n${jobLines}${disclaimer}`
}

// ============================================
// SESSION EXPIRED MESSAGES
// ============================================
const SESSION_EXPIRED_MESSAGES = {
  ms: (name: string, data: any) => `Hai ${name}, lama tak jumpa!

Sesi sebelum dah tamat. Ni info yang ada:
📍 Lokasi: ${data.location_city || 'Tak letak'}, ${data.location_state || 'Tak letak'}
👤 Umur: ${data.age || 'Tak letak'} | Jantina: ${data.gender === 'male' ? 'Lelaki' : data.gender === 'female' ? 'Perempuan' : 'Tak letak'}

Nak buat apa?
1. Tengok kerja guna info lama
2. Start baru dengan info baru

Balas *1* atau *2*`,

  en: (name: string, data: any) => `Welcome back, ${name}!

Your previous session has expired. Here's what we had:
📍 Location: ${data.location_city || 'Not specified'}, ${data.location_state || 'Not specified'}
👤 Age: ${data.age || 'Not specified'} | Gender: ${data.gender === 'male' ? 'Male' : data.gender === 'female' ? 'Female' : 'Not specified'}

Would you like to:
1. See jobs matching your previous criteria
2. Start fresh with new information

Reply with *1* or *2*`,

  zh: (name: string, data: any) => `欢迎回来，${name}！

您之前的会话已过期。这是您的信息：
📍 地点：${data.location_city || '未指定'}，${data.location_state || '未指定'}
👤 年龄：${data.age || '未指定'} | 性别：${data.gender === 'male' ? '男' : data.gender === 'female' ? '女' : '未指定'}

您想要：
1. 查看符合之前条件的工作
2. 重新开始输入新信息

请回复 *1* 或 *2*`
}

// ============================================
// CUSTOMER SERVICE MESSAGES
// ============================================
const CUSTOMER_SERVICE_MESSAGES = {
  ms: `Nak bercakap dengan manusia? Boleh je!

Hubungi khidmat pelanggan 101Kerja:
📞 WhatsApp: +60142661357
📧 Email: support@101kerja.com

Atau balas "kerja" untuk teruskan cari kerja dengan Kak Ani.`,
  en: `Want to speak to a human? Sure thing!

Contact 101Kerja customer service:
📞 WhatsApp: +60142661357
📧 Email: support@101kerja.com

Or reply "jobs" to continue finding jobs with me.`,
  zh: `想和真人交谈？没问题！

联系101Kerja客户服务：
📞 WhatsApp: +60142661357
📧 Email: support@101kerja.com

或回复"工作"继续和我找工作。`
}

// ============================================
// MAIN HANDLER
// ============================================
serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { user, message, messageType, locationData }: ProcessRequest = await req.json()

    console.log(`🤖 Kak Ani processing for user ${user.id}`)
    console.log(`   📊 Status: ${user.onboarding_status}, Step: ${user.onboarding_step}`)
    console.log(`   💬 Message: "${message.substring(0, 50)}..."`)

    // Easter egg: Thanos reset
    if (message.toLowerCase().trim() === 'thanos') {
      const resetResult = await handleThanosReset(user)
      return jsonResponse(resetResult)
    }

    // Check if user is banned
    if (user.banned_until) {
      const banExpiry = new Date(user.banned_until)
      const now = new Date()
      if (banExpiry > now) {
        // User is still banned
        const lang = user.preferred_language || 'ms'
        const hoursLeft = Math.ceil((banExpiry.getTime() - now.getTime()) / (1000 * 60 * 60))
        console.log(`🚫 Banned user ${user.phone_number} tried to message. Ban expires in ${hoursLeft}h`)

        const banMessage = getText(lang, {
          ms: `Akaun anda telah disekat sementara kerana melanggar peraturan.\n\nSebab: ${user.ban_reason || 'Bahasa tidak sesuai'}\nBaki masa: ${hoursLeft} jam lagi\n\nSila cuba lagi selepas tempoh sekatan tamat.`,
          en: `Your account has been temporarily suspended for violating our guidelines.\n\nReason: ${user.ban_reason || 'Inappropriate language'}\nTime remaining: ${hoursLeft} hour(s)\n\nPlease try again after the suspension period ends.`,
          zh: `您的账户因违反规定已被暂时封禁。\n\n原因：${user.ban_reason || '不当语言'}\n剩余时间：${hoursLeft}小时\n\n请在封禁期结束后再试。`
        })
        return jsonResponse({ response: banMessage, updatedUser: user })
      } else {
        // Ban has expired - clear it
        console.log(`✅ Ban expired for ${user.phone_number}, clearing...`)
        await supabase.from('applicants').update({
          banned_until: null,
          ban_reason: null,
          updated_at: new Date().toISOString()
        }).eq('id', user.id)
        user.banned_until = undefined
        user.ban_reason = undefined
      }
    }

    // Check for profanity (with violation tracking)
    if (containsProfanity(message)) {
      console.log(`⚠️ Profanity detected from ${user.phone_number}`)
      const result = await handleProfanityViolation(user, message)
      return jsonResponse(result)
    }

    // Check for customer service request
    if (detectCustomerServiceIntent(message)) {
      const lang = user.preferred_language || 'ms'
      return jsonResponse({
        response: CUSTOMER_SERVICE_MESSAGES[lang as keyof typeof CUSTOMER_SERVICE_MESSAGES] || CUSTOMER_SERVICE_MESSAGES.ms,
        updatedUser: user
      })
    }

    // Check for language change command (mid-flow)
    const langChangeResult = detectLanguageChangeCommand(message)
    if (langChangeResult && user.onboarding_status !== 'new') {
      const updatedUser = { ...user, preferred_language: langChangeResult }
      await updateUserInDB(user.id, updatedUser, user.onboarding_step || 'welcome')

      const langChangedMessages = {
        en: "Language changed to English. How can I help you find a job?",
        ms: "Ok dah tukar ke Bahasa Malaysia. Nak cari kerja apa?",
        zh: "语言已切换为中文。我能帮您找什么工作？"
      }
      return jsonResponse({
        response: langChangedMessages[langChangeResult as keyof typeof langChangedMessages],
        updatedUser
      })
    }

    // Check if user is responding to session expired prompt (BEFORE timeout check)
    // This handles the case where user replies "1" or "2" to the menu
    const convState = user.conversation_state || {}
    if (convState.session_expired_prompt && user.full_name) {
      console.log('📋 User responding to session expired prompt')
      const result = await handleSessionExpired(user, message)
      return jsonResponse(result)
    }

    // Check if user is responding to restart location prompt
    if (convState.restart_location_prompt && user.full_name) {
      console.log('📋 User responding to restart location prompt')
      const result = await handleRestartLocationChoice(user, message)
      return jsonResponse(result)
    }

    // Check for session timeout (30 minutes)
    const sessionExpired = checkSessionTimeout(user)
    if (sessionExpired && user.full_name) {
      const result = await handleSessionExpired(user, message)
      return jsonResponse(result)
    }

    // Check for shortcode commands (geo-xxxx / com-xxxx)
    const shortcode = detectShortcode(message)
    if (shortcode) {
      console.log(`🔗 Shortcode detected: ${shortcode.type}-${shortcode.slug}`)
      const result = await handleShortcodeSearch(user, shortcode.type, shortcode.slug)
      return jsonResponse(result)
    }

    // Process with Kak Ani
    const result = await processWithKakAni(user, message, messageType, locationData)

    return jsonResponse(result)

  } catch (error) {
    console.error('❌ Bot processor error:', error)
    return jsonResponse({
      response: "Alamak, ada masalah teknikal la adik. Cuba hantar mesej sekali lagi ye?",
      error: error.message
    })
  }
})

// ============================================
// SESSION TIMEOUT CHECK
// ============================================
function checkSessionTimeout(user: User): boolean {
  if (!user.last_active_at) return false

  const lastActive = new Date(user.last_active_at).getTime()
  const now = Date.now()
  const timeSinceLastMessage = now - lastActive

  return timeSinceLastMessage > SESSION_TIMEOUT_MS
}

// ============================================
// HANDLE SESSION EXPIRED
// ============================================
async function handleSessionExpired(user: User, message: string): Promise<{ response: string, updatedUser: User }> {
  const lang = user.preferred_language || 'ms'
  const convState = user.conversation_state || {}

  // Check if user is responding to the session expired prompt
  if (convState.session_expired_prompt) {
    const choice = message.trim()

    if (choice === '1' || /yes|ya|是|same|previous|sebelum|lama|kerja|job/i.test(choice)) {
      // User wants to see new jobs - ask for location first (don't assume old location)
      console.log("User chose to see new jobs - asking for location")

      const updatedUser: User = {
        ...user,
        onboarding_status: 'in_progress',
        onboarding_step: 'update_location',
        conversation_state: { updating_location_only: true },
        // Clear old location so user must provide fresh location
        location_city: undefined,
        location_state: undefined,
        latitude: undefined,
        longitude: undefined
      }

      await supabase.from('applicants').update({
        onboarding_status: 'in_progress',
        onboarding_step: 'update_location',
        conversation_state: { updating_location_only: true },
        location_city: null,
        location_state: null,
        latitude: null,
        longitude: null,
        updated_at: new Date().toISOString()
      }).eq('id', user.id)

      const firstName = user.full_name?.split(' ')[0] || ''
      const response = getText(lang, {
        ms: `Ok ${firstName}! Adik nak cari kerja kat mana?\n\nBagitahu bandar dan negeri ye.\n\nContoh: "Shah Alam, Selangor" atau "Johor Bahru"`,
        en: `Ok ${firstName}! Where would you like to find jobs?\n\nTell me the city and state.\n\nExample: "Shah Alam, Selangor" or "Johor Bahru"`,
        zh: `好的${firstName}！你想在哪里找工作？\n\n告诉我城市和州。\n\n例如："Shah Alam, Selangor" 或 "Johor Bahru"`
      })

      return { response, updatedUser }
    } else if (choice === '2' || /no|tidak|否|new|start|fresh|baru|update/i.test(choice)) {
      // Update location only (keep name, age, gender)
      console.log("User chose to update location")

      const updatedUser: User = {
        ...user,
        onboarding_status: 'in_progress',
        onboarding_step: 'update_location',
        conversation_state: { updating_location_only: true },
        location_city: undefined,
        location_state: undefined,
        latitude: undefined,
        longitude: undefined
      }

      await supabase.from('applicants').update({
        onboarding_status: 'in_progress',
        onboarding_step: 'update_location',
        conversation_state: { updating_location_only: true },
        location_city: null,
        location_state: null,
        latitude: null,
        longitude: null,
        updated_at: new Date().toISOString()
      }).eq('id', user.id)

      // Ask for new location only
      const firstName = user.full_name?.split(' ')[0] || ''
      const response = getText(lang, {
        ms: `Ok ${firstName}, nak update lokasi je kan?\n\nSekarang adik duduk kat mana? Bagitahu bandar dan negeri ye.\n\nContoh: "Shah Alam, Selangor" atau "Johor Bahru"`,
        en: `Ok ${firstName}, just updating your location?\n\nWhere do you live now? Tell me the city and state.\n\nExample: "Shah Alam, Selangor" or "Johor Bahru"`,
        zh: `好的${firstName}，只更新位置对吧？\n\n你现在住在哪里？告诉我城市和州。\n\n例如："Shah Alam, Selangor" 或 "Johor Bahru"`
      })

      return { response, updatedUser }
    }
  }

  // Show session expired message with previous selections
  const previousSelections = await getUserJobSelections(user.id, 5)
  const selectionsMessage = previousSelections.length > 0
    ? formatJobSelectionsMessage(previousSelections, lang) + '\n\n'
    : ''

  const firstName = user.full_name?.split(' ')[0] || 'there'

  const sessionExpiredMsg = getText(lang, {
    ms: `Hai ${firstName}, lama tak jumpa!\n\n${selectionsMessage}Nak buat apa?\n1. Tengok kerja baru\n2. Update maklumat diri\n\nBalas *1* atau *2*`,
    en: `Welcome back, ${firstName}!\n\n${selectionsMessage}What would you like to do?\n1. See new jobs\n2. Update my info\n\nReply *1* or *2*`,
    zh: `欢迎回来，${firstName}！\n\n${selectionsMessage}您想要：\n1. 查看新工作\n2. 更新我的信息\n\n请回复 *1* 或 *2*`
  })

  // Mark that we showed the session expired prompt
  await supabase.from('applicants').update({
    conversation_state: { ...user.conversation_state, session_expired_prompt: true },
    updated_at: new Date().toISOString()
  }).eq('id', user.id)

  return { response: sessionExpiredMsg, updatedUser: { ...user, conversation_state: { session_expired_prompt: true } } }
}

// ============================================
// HAVERSINE DISTANCE CALCULATION
// ============================================
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  // Returns distance in kilometers
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
// DETECT CUSTOMER SERVICE INTENT
// ============================================
function detectCustomerServiceIntent(message: string): boolean {
  const lower = message.toLowerCase().trim()
  const csKeywords = [
    'customer service', 'agent', 'human', 'manusia', 'staff', 'support',
    'bantuan', 'help me', 'tolong', 'complain', 'aduan', 'masalah',
    'talk to someone', 'speak to someone', 'nak cakap dengan orang',
    '客服', '人工', '帮助'
  ]
  return csKeywords.some(keyword => lower.includes(keyword))
}

// ============================================
// SHORTCODE DETECTION (geo-xxxx / com-xxxx)
// ============================================
function detectShortcode(message: string): { type: 'geo' | 'com', slug: string } | null {
  const match = message.trim().match(/^(geo|com)-(.+)$/i)
  if (!match) return null
  return { type: match[1].toLowerCase() as 'geo' | 'com', slug: match[2].toLowerCase() }
}

function expandSlug(slug: string): string {
  // Known abbreviation prefixes (order matters - longer first)
  const abbreviations: Record<string, string> = {
    'sg': 'sungai',
    'bt': 'batu',
    'jln': 'jalan',
    'tmn': 'taman',
    'bdr': 'bandar',
    'bndr': 'bandar',
    'kpg': 'kampung',
    'kg': 'kampung',
    'pj': 'petaling jaya',
    'jb': 'johor bahru',
    'kl': 'kuala lumpur',
    'kk': 'kota kinabalu',
    'kb': 'kota bharu',
    'sa': 'shah alam',
    'pd': 'port dickson',
    'bm': 'bukit mertajam',
    'sp': 'sungai petani',
    'tj': 'tanjung',
    'ulu': 'ulu',
    'sri': 'sri',
    'air': 'air',
  }

  // Sort abbreviations by length (longest first) to avoid partial matches
  const sortedAbbrevs = Object.entries(abbreviations).sort((a, b) => b[0].length - a[0].length)

  let expanded = slug

  // Try to split known abbreviation prefixes from the rest of the slug
  for (const [abbr, full] of sortedAbbrevs) {
    if (expanded.startsWith(abbr) && expanded.length > abbr.length) {
      const rest = expanded.slice(abbr.length)
      // Recursively expand the rest
      expanded = full + ' ' + rest
      break
    }
  }

  // Insert spaces between words that are run together (camelCase-like detection for lowercase)
  // This handles cases like "yongpeng" which should stay as-is (it's a real place name)
  
  return expanded.trim()
}

function buildIlikePattern(searchTerm: string): string {
  // Split into words and join with % for fuzzy ILIKE matching
  const words = searchTerm.split(/\s+/).filter(w => w.length > 0)
  return `%${words.join('%')}%`
}

async function handleShortcodeSearch(
  user: User,
  type: 'geo' | 'com',
  slug: string
): Promise<{ response: string, updatedUser: User }> {
  const lang = 'ms' // Default to Malay for first message
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
    // No jobs found - fall through to normal onboarding
    // Set user to new so they go through normal flow
    const updatedUser: User = {
      ...user,
      onboarding_status: 'new',
      conversation_state: {}
    }
    
    const searchLabel = type === 'geo' ? expanded : expanded
    const noJobsMsg = `Maaf, tiada kerja dijumpai untuk "${expanded}".\n\nTakpe, Kak Ani boleh tolong cari kerja lain!\n\nSebelum tu, adik prefer bahasa apa?\n1. Bahasa Malaysia\n2. English\n3. 中文 (Chinese)`

    // Update DB to start normal onboarding
    await supabase.from('applicants').update({
      onboarding_status: 'in_progress',
      onboarding_step: 'language',
      conversation_state: {},
      updated_at: new Date().toISOString()
    }).eq('id', user.id)

    return {
      response: noJobsMsg,
      updatedUser: { ...updatedUser, onboarding_status: 'in_progress', onboarding_step: 'language' }
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

  const jobsMessage = formatJobsMessage(matchedJobs, 0, lang)

  const searchTypeLabel = type === 'geo'
    ? `dekat ${expanded.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`
    : `di ${expanded.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`

  const response = `Salam! Saya Kak Ani dari 101Kerja.\n\nJumpa ${matchedJobs.length} kerja ${searchTypeLabel}:\n\n${jobsMessage}\n\n━━━━━━━━━━━━━━━━━━━━\n\nUntuk mohon, Kak Ani perlukan maklumat adik:\n- Nama penuh\n- Umur\n- Lelaki/Perempuan\n- Duduk mana (bandar, negeri)\n\nContoh: "Ahmad, 25, lelaki, Shah Alam Selangor"`

  // Update user state
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

  console.log(`🔗 Shortcode: Found ${matchedJobs.length} jobs, set to collect_info with shortcode_jobs`)

  return { response, updatedUser }
}

// ============================================
// DETECT LANGUAGE CHANGE COMMAND
// ============================================
function detectLanguageChangeCommand(message: string): string | null {
  const lower = message.toLowerCase().trim()

  const langCommands: Record<string, string> = {
    'english': 'en',
    'bahasa': 'ms',
    'malay': 'ms',
    'melayu': 'ms',
    'mandarin': 'zh',
    'chinese': 'zh',
    '中文': 'zh',
    '华语': 'zh'
  }

  // Only trigger if the message is JUST the language name
  if (langCommands[lower]) {
    return langCommands[lower]
  }

  return null
}

// ============================================
// KAK ANI CONVERSATION PROCESSOR
// ============================================
async function processWithKakAni(
  user: User,
  message: string,
  messageType: string,
  locationData: any
): Promise<{ response: string, updatedUser: User }> {

  const step = user.onboarding_step || 'welcome'

  // Check for restart command anywhere (with language detection)
  const restartCheck = detectRestartCommand(message)
  if (restartCheck.isRestart) {
    // If language detected from command, update user's preferred language
    if (restartCheck.detectedLang) {
      user.preferred_language = restartCheck.detectedLang
      await supabase.from('applicants').update({
        preferred_language: restartCheck.detectedLang,
        updated_at: new Date().toISOString()
      }).eq('id', user.id)
    }
    return await handleRestart(user)
  }

  switch (user.onboarding_status) {
    case 'new':
      return await handleNewUserConversational(user)

    case 'in_progress':
      return await handleOnboardingConversational(user, message, step)

    case 'completed':
      return await handleCompletedUserConversational(user, message)

    case 'matching':
      return await handleMatchingConversational(user, message)

    default:
      const response = await generateKakAniResponse(
        user,
        message,
        "User dalam state yang tak dikenali. Bantu mereka mulakan semula."
      )
      return { response, updatedUser: user }
  }
}

// ============================================
// RESTART COMMAND DETECTION (with language detection)
// ============================================
function detectRestartCommand(message: string): { isRestart: boolean, detectedLang: string | null } {
  const lower = message.toLowerCase().trim()

  // Map restart commands to their language
  const restartCommands: Record<string, string> = {
    // English commands → 'en'
    'restart': 'en',
    'start over': 'en',
    'reset': 'en',
    // Malay commands → 'ms'
    'mula semula': 'ms',
    'mulakan semula': 'ms',
    'semula': 'ms',
    // Chinese commands → 'zh'
    '重新开始': 'zh',
    '重新': 'zh'
  }

  for (const [command, lang] of Object.entries(restartCommands)) {
    if (lower === command || lower.includes(command)) {
      return { isRestart: true, detectedLang: lang }
    }
  }

  return { isRestart: false, detectedLang: null }
}

// Backward compatibility wrapper
function isRestartCommand(message: string): boolean {
  return detectRestartCommand(message).isRestart
}

async function handleRestart(user: User): Promise<{ response: string, updatedUser: User }> {
  const lang = user.preferred_language || 'ms'

  // Check if user already has complete profile
  const hasProfile = user.full_name && user.age && user.gender && (user.location_city || user.location_state)

  if (hasProfile) {
    // User has profile - ask if they want to use current location or enter new one
    console.log('🔄 Restart with existing profile, asking for location preference...')

    const firstName = user.full_name?.split(' ')[0] || ''
    const currentLocation = [user.location_city, user.location_state].filter(Boolean).join(', ')

    // Fetch previous job selections for display
    const previousSelections = await getUserJobSelections(user.id, 5)
    const selectionsMessage = previousSelections.length > 0
      ? formatJobSelectionsMessage(previousSelections, lang) + '\n\n━━━━━━━━━━━━━━━━━━━━\n\n'
      : ''

    const updatedUser = {
      ...user,
      conversation_state: { restart_location_prompt: true }
    }

    await supabase.from('applicants').update({
      conversation_state: { restart_location_prompt: true },
      updated_at: new Date().toISOString()
    }).eq('id', user.id)

    const responseText = getText(lang, {
      ms: `Ok ${firstName}!\n\n${selectionsMessage}Nak cari kerja kat mana?\n\n1. Dekat lokasi semasa (${currentLocation})\n2. Masukkan lokasi baru\n\nBalas *1* atau *2*`,
      en: `Ok ${firstName}!\n\n${selectionsMessage}Where would you like to find jobs?\n\n1. Near current location (${currentLocation})\n2. Enter a new location\n\nReply *1* or *2*`,
      zh: `好的${firstName}！\n\n${selectionsMessage}您想在哪里找工作？\n\n1. 当前位置附近（${currentLocation}）\n2. 输入新位置\n\n请回复 *1* 或 *2*`
    })

    return {
      response: responseText,
      updatedUser
    }
  }

  // No profile - start fresh
  console.log('🔄 Restart without profile, starting fresh...')

  await supabase.from('applicants').update({
    onboarding_status: 'new',
    onboarding_step: null,
    conversation_state: null,
    updated_at: new Date().toISOString()
  }).eq('id', user.id)

  const resetUser: User = {
    ...user,
    onboarding_status: 'new',
    onboarding_step: undefined,
    conversation_state: {}
  }

  return await handleNewUserConversational(resetUser)
}

// ============================================
// HANDLE RESTART LOCATION CHOICE
// ============================================
async function handleRestartLocationChoice(user: User, message: string): Promise<{ response: string, updatedUser: User }> {
  const lang = user.preferred_language || 'ms'
  const choice = message.trim()

  if (choice === '1' || /current|semasa|sekarang|sama|same|dekat|nearby/i.test(choice)) {
    // Use current location - find jobs
    console.log('🔄 User chose current location, finding jobs...')

    const matchResult = await findAndPresentJobsConversational(user)

    const updatedUser = {
      ...user,
      onboarding_status: 'matching',
      conversation_state: buildPostSearchState(matchResult)
    }

    await supabase.from('applicants').update({
      onboarding_status: 'matching',
      onboarding_step: 'viewing_jobs',
      conversation_state: updatedUser.conversation_state,
      updated_at: new Date().toISOString()
    }).eq('id', user.id)

    const firstName = user.full_name?.split(' ')[0] || ''
    const jobCount = matchResult.jobs.length
    const responseText = jobCount > 0
      ? getText(lang, {
          ms: `Ok ${firstName}, Kak Ani carikan kerja dekat ${user.location_city || user.location_state}!\n\nJumpa ${jobCount} kerja:\n\n${matchResult.message}`,
          en: `Ok ${firstName}, finding jobs near ${user.location_city || user.location_state}!\n\nFound ${jobCount} jobs:\n\n${matchResult.message}`,
          zh: `好的${firstName}，正在查找${user.location_city || user.location_state}附近的工作！\n\n找到${jobCount}个工作：\n\n${matchResult.message}`
        })
      : matchResult.message

    return { response: responseText, updatedUser }

  } else if (choice === '2' || /new|baru|lain|other|different|masuk|enter/i.test(choice)) {
    // Enter new location
    console.log('🔄 User chose to enter new location')

    const updatedUser: User = {
      ...user,
      onboarding_status: 'in_progress',
      onboarding_step: 'update_location',
      conversation_state: { updating_location_only: true },
      location_city: undefined,
      location_state: undefined,
      latitude: undefined,
      longitude: undefined
    }

    await supabase.from('applicants').update({
      onboarding_status: 'in_progress',
      onboarding_step: 'update_location',
      conversation_state: { updating_location_only: true },
      location_city: null,
      location_state: null,
      latitude: null,
      longitude: null,
      updated_at: new Date().toISOString()
    }).eq('id', user.id)

    const firstName = user.full_name?.split(' ')[0] || ''
    const response = getText(lang, {
      ms: `Ok ${firstName}! Adik nak cari kerja kat mana?\n\nBagitahu bandar dan negeri ye.\n\nContoh: "Shah Alam, Selangor" atau "Johor Bahru"`,
      en: `Ok ${firstName}! Where would you like to find jobs?\n\nTell me the city and state.\n\nExample: "Shah Alam, Selangor" or "Johor Bahru"`,
      zh: `好的${firstName}！你想在哪里找工作？\n\n告诉我城市和州。\n\n例如："Shah Alam, Selangor" 或 "Johor Bahru"`
    })

    return { response, updatedUser }
  }

  // Invalid choice - ask again
  const currentLocation = [user.location_city, user.location_state].filter(Boolean).join(', ')
  const response = getText(lang, {
    ms: `Tak faham tu. Balas *1* atau *2* ye:\n\n1. Dekat lokasi semasa (${currentLocation})\n2. Masukkan lokasi baru`,
    en: `Didn't catch that. Please reply *1* or *2*:\n\n1. Near current location (${currentLocation})\n2. Enter a new location`,
    zh: `没听懂。请回复 *1* 或 *2*：\n\n1. 当前位置附近（${currentLocation}）\n2. 输入新位置`
  })

  return { response, updatedUser: user }
}

// ============================================
// NEW USER - CONVERSATIONAL
// ============================================
async function handleNewUserConversational(user: User): Promise<{ response: string, updatedUser: User }> {
  const { error } = await supabase
    .from('applicants')
    .update({
      onboarding_status: 'in_progress',
      onboarding_step: 'language',
      conversation_state: {},
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id)

  if (error) console.error('Error updating new user:', error)

  const greeting = getTimeBasedGreeting()

  const response = `${greeting.ms}!

Saya Kak Ani dari 101Kerja. Saya nak tolong adik cari kerja yang sesuai.

Sebelum tu, adik prefer bahasa apa?
1. Bahasa Malaysia
2. English
3. 中文 (Chinese)`

  return {
    response,
    updatedUser: { ...user, onboarding_status: 'in_progress', onboarding_step: 'language' }
  }
}

// ============================================
// ONBOARDING - SIMPLIFIED 2-STEP FLOW (No confirmation)
// ============================================
async function handleOnboardingConversational(
  user: User,
  message: string,
  step: string
): Promise<{ response: string, updatedUser: User }> {

  let updatedUser = { ...user }
  let nextStep = step
  let response = ''

  const lang = user.preferred_language || 'ms'

  console.log(`📍 Onboarding step: ${step}, message: "${message}"`)

  switch (step) {
    // ========== STEP 1: LANGUAGE ==========
    case 'language':
      const langResult = await extractLanguageChoice(message)
      if (langResult) {
        updatedUser.preferred_language = langResult
        nextStep = 'collect_info'

        response = getText(langResult, {
          ms: `Okay, Bahasa Malaysia!

Boleh bagitahu Kak Ani:
- Nama penuh
- Umur
- Lelaki/Perempuan
- Duduk mana (bandar, negeri)

Contoh: "Ahmad, 25, lelaki, Shah Alam Selangor"`,
          en: `Alright, English it is!

Please tell me:
- Your full name
- Age
- Male/Female
- Where you live (city, state)

Example: "Ahmad, 25, male, Shah Alam Selangor"`,
          zh: `好的，中文！

请告诉我：
- 全名
- 年龄
- 男/女
- 住哪里（城市，州）

例如："Ahmad, 25, 男, Shah Alam Selangor"`
        })
      } else {
        response = `Hmm tak faham la. Pilih bahasa:
1. Bahasa Malaysia
2. English
3. 中文 (Chinese)`
      }
      break

    // ========== STEP 2: COLLECT ALL INFO ==========
    case 'collect_info':
      console.log('📝 collect_info: Starting extraction...')

      // Check conversation state FIRST to determine what to extract
      const convState = user.conversation_state || {}
      const isLocationClarification = convState.location_clarification_pending || convState.ambiguous_location_pending

      const extracted = await extractAllInfo(message, lang)
      console.log('📝 collect_info: Extracted:', JSON.stringify(extracted))

      // MERGE: new extracted data with existing user data
      // BUT: If we're in location clarification mode, DON'T overwrite name/age/gender!
      if (!isLocationClarification) {
        // Normal flow: merge all fields
        if (extracted.name) updatedUser.full_name = extracted.name.toUpperCase()
        if (extracted.age) updatedUser.age = extracted.age
        if (extracted.gender) updatedUser.gender = extracted.gender
      } else {
        // Location clarification: preserve existing user info
        console.log('📝 collect_info: In location clarification mode - preserving user info')
      }
      // Always merge location fields
      if (extracted.city) updatedUser.location_city = extracted.city
      if (extracted.state) updatedUser.location_state = extracted.state
      if (extracted.lat) updatedUser.latitude = extracted.lat
      if (extracted.lng) updatedUser.longitude = extracted.lng

      // Check what's missing from MERGED user data
      const mergedInfo: ExtractedInfo = {
        name: updatedUser.full_name || null,
        age: updatedUser.age || null,
        gender: updatedUser.gender || null,
        city: updatedUser.location_city || null,
        state: updatedUser.location_state || null,
        lat: updatedUser.latitude || null,
        lng: updatedUser.longitude || null
      }
      const missing = getMissingFields(mergedInfo)
      console.log('📝 collect_info: Missing fields:', missing)

      // Check if user is responding to ambiguous location prompt (reply with number)
      if (convState.ambiguous_location_pending && convState.ambiguous_city && convState.ambiguous_states) {
        const choiceNum = parseInt(message.trim())
        if (choiceNum >= 1 && choiceNum <= convState.ambiguous_states.length) {
          // User chose a state number - combine city with chosen state
          const chosenState = convState.ambiguous_states[choiceNum - 1]
          const cityWithState = `${convState.ambiguous_city}, ${chosenState}`
          console.log(`📝 collect_info: User chose state #${choiceNum} = ${chosenState}, geocoding "${cityWithState}"...`)

          // Re-extract with full location (city + state)
          const reExtracted = await extractAllInfo(cityWithState, lang)

          if (reExtracted.lat && reExtracted.lng) {
            updatedUser.location_city = reExtracted.city || convState.ambiguous_city
            updatedUser.location_state = reExtracted.state || chosenState
            updatedUser.latitude = reExtracted.lat
            updatedUser.longitude = reExtracted.lng
            updatedUser.conversation_state = {} // Clear ambiguous state

            // Now find jobs
            const matchResult = await findAndPresentJobsConversational(updatedUser)
            updatedUser.onboarding_status = 'matching'
            updatedUser.conversation_state = buildPostSearchState(matchResult)
            nextStep = 'viewing_jobs'

            const firstName = updatedUser.full_name?.split(' ')[0] || ''
            const jobCount = matchResult.jobs.length
            response = jobCount > 0
              ? getText(lang, {
                  ms: `Ok noted!\nNama: ${updatedUser.full_name}\nUmur: ${updatedUser.age}\nJantina: ${updatedUser.gender === 'male' ? 'Lelaki' : 'Perempuan'}\n\nOkay ${firstName}, jap ye Kak Ani carikan...\n\nNi ${jobCount} kerja dekat dengan adik:\n\n${matchResult.message}`,
                  en: `Ok noted!\nName: ${updatedUser.full_name}\nAge: ${updatedUser.age}\nGender: ${updatedUser.gender === 'male' ? 'Male' : 'Female'}\n\nAlright ${firstName}, let me check...\n\nFound ${jobCount} jobs near you:\n\n${matchResult.message}`,
                  zh: `好的！\n姓名：${updatedUser.full_name}\n年龄：${updatedUser.age}\n性别：${updatedUser.gender === 'male' ? '男' : '女'}\n\n好的${firstName}，让我找找...\n\n找到${jobCount}个附近的工作：\n\n${matchResult.message}`
                })
              : `Ok noted!\nNama: ${updatedUser.full_name}\nUmur: ${updatedUser.age}\n\n${matchResult.message}`
            break
          } else {
            // Geocoding failed - ask for more specific location but KEEP user's info
            console.log(`📝 collect_info: Geocoding failed for "${cityWithState}", asking for more details...`)

            const firstName = updatedUser.full_name?.split(' ')[0] || ''
            // Store user's confirmed info so it doesn't get overwritten
            updatedUser.conversation_state = {
              location_clarification_pending: true,
              confirmed_name: updatedUser.full_name,
              confirmed_age: updatedUser.age,
              confirmed_gender: updatedUser.gender,
              attempted_city: convState.ambiguous_city,
              attempted_state: chosenState
            }

            response = getText(lang, {
              ms: `Ok ${firstName}, Kak Ani dah noted nama dan maklumat adik.\n\nTapi "${convState.ambiguous_city}, ${chosenState}" tu Kak Ani tak jumpa dalam peta.\n\nCuba bagitahu nama bandar besar yang dekat - contoh "Muar" atau "Batu Pahat"?`,
              en: `Ok ${firstName}, I've noted your details.\n\nBut I couldn't find "${convState.ambiguous_city}, ${chosenState}" on the map.\n\nCan you tell me the nearest major town - like "Muar" or "Batu Pahat"?`,
              zh: `好的${firstName}，我已记下您的信息。\n\n但是我在地图上找不到"${convState.ambiguous_city}, ${chosenState}"。\n\n能告诉我最近的大城镇吗？比如"Muar"或"Batu Pahat"？`
            })
            break
          }
        }
      }

      // Check if user is providing location after clarification request
      if (convState.location_clarification_pending) {
        console.log(`📝 collect_info: Location clarification pending, extracting location only from "${message}"...`)

        // Only extract location from this message - don't overwrite user's confirmed info
        let locationExtracted = await extractAllInfo(message, lang)

        // FALLBACK: If no coordinates, try DB lookup directly
        // GPT might extract city="Klang" but no coords - we still need to look it up
        if (!locationExtracted.lat || !locationExtracted.lng) {
          const cityToLookup = locationExtracted.city || message.trim()
          console.log(`📝 No coords from GPT, trying DB lookup for "${cityToLookup}"...`)
          const dbLookup = await lookupMalaysiaLocation(cityToLookup)
          if (dbLookup) {
            console.log(`✅ Found "${cityToLookup}" in malaysia_locations: ${dbLookup.state}`)
            locationExtracted = {
              ...locationExtracted,
              city: locationExtracted.city || cityToLookup,
              state: dbLookup.state,
              lat: dbLookup.lat,
              lng: dbLookup.lng
            }
          }
        }

        if (locationExtracted.lat && locationExtracted.lng) {
          // Got valid coordinates - restore user info and find jobs
          updatedUser.full_name = convState.confirmed_name || updatedUser.full_name
          updatedUser.age = convState.confirmed_age || updatedUser.age
          updatedUser.gender = convState.confirmed_gender || updatedUser.gender
          updatedUser.location_city = locationExtracted.city
          updatedUser.location_state = locationExtracted.state
          updatedUser.latitude = locationExtracted.lat
          updatedUser.longitude = locationExtracted.lng
          updatedUser.conversation_state = {} // Clear pending state

          const matchResult = await findAndPresentJobsConversational(updatedUser)
          updatedUser.onboarding_status = 'matching'
          updatedUser.conversation_state = buildPostSearchState(matchResult)
          nextStep = 'viewing_jobs'

          const firstName = updatedUser.full_name?.split(' ')[0] || ''
          const jobCount = matchResult.jobs.length
          response = jobCount > 0
            ? getText(lang, {
                ms: `Ok ${firstName}, jap ye Kak Ani carikan kerja dekat ${locationExtracted.city || locationExtracted.state}...\n\nNi ${jobCount} kerja dekat dengan adik:\n\n${matchResult.message}`,
                en: `Ok ${firstName}, let me find jobs near ${locationExtracted.city || locationExtracted.state}...\n\nFound ${jobCount} jobs near you:\n\n${matchResult.message}`,
                zh: `好的${firstName}，让我找找${locationExtracted.city || locationExtracted.state}附近的工作...\n\n找到${jobCount}个附近的工作：\n\n${matchResult.message}`
              })
            : matchResult.message
          break
        } else {
          // Still can't geocode - ask again
          const firstName = convState.confirmed_name?.split(' ')[0] || ''
          response = getText(lang, {
            ms: `Hmm "${message}" tu pun Kak Ani tak jumpa.\n\n${firstName}, cuba bagitahu nama bandar yang lebih dikenali? Contoh: "Johor Bahru", "Muar", "Batu Pahat"`,
            en: `Hmm I couldn't find "${message}" either.\n\n${firstName}, can you try a more well-known town name? Like "Johor Bahru", "Muar", "Batu Pahat"`,
            zh: `嗯，我也找不到"${message}"。\n\n${firstName}，能试试更知名的城镇名吗？比如"Johor Bahru"、"Muar"、"Batu Pahat"`
          })
          break
        }
      }

      if (missing.length === 0) {
        // Check if location is ambiguous (exists in multiple states)
        if (extracted.ambiguous && extracted.possible_states && extracted.possible_states.length > 0) {
          console.log('📝 collect_info: Ambiguous location detected, asking for clarification...')

          // Store ambiguous location info in conversation_state for when user replies with number
          const locationText = mergedInfo.city || mergedInfo.state
          updatedUser.location_city = undefined
          updatedUser.location_state = undefined
          updatedUser.latitude = undefined
          updatedUser.longitude = undefined
          updatedUser.conversation_state = {
            ...updatedUser.conversation_state,
            ambiguous_location_pending: true,
            ambiguous_city: locationText,
            ambiguous_states: extracted.possible_states
          }

          response = getText(lang, {
            ms: `"${locationText}" ni ada kat beberapa tempat.\n\nAdik duduk kat negeri mana?\n${extracted.possible_states.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nBalas nombor atau tulis nama penuh (contoh: "${locationText}, Selangor")`,
            en: `"${locationText}" exists in multiple areas.\n\nWhich state do you live in?\n${extracted.possible_states.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nReply with the number or full name (e.g., "${locationText}, Selangor")`,
            zh: `"${locationText}"在多个地区都有。\n\n你住在哪个州？\n${extracted.possible_states.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n回复数字或完整地名（如："${locationText}, Selangor"）`
          })
          // Stay in collect_info, don't change step
        } else if ((mergedInfo.city || mergedInfo.state) && (!mergedInfo.lat || !mergedInfo.lng)) {
          // Check if we have location text but no coordinates (GPT couldn't geocode)
          console.log('📝 collect_info: Location provided but no coordinates, asking for clarification...')

          // DON'T save incomplete location to DB - clear it until user provides geocodable location
          const locationText = mergedInfo.city || mergedInfo.state
          updatedUser.location_city = undefined
          updatedUser.location_state = undefined
          updatedUser.latitude = undefined
          updatedUser.longitude = undefined

          // SET FLAG so next message only extracts location, not name/age/gender
          updatedUser.conversation_state = {
            location_clarification_pending: true,
            confirmed_name: updatedUser.full_name,
            confirmed_age: updatedUser.age,
            confirmed_gender: updatedUser.gender,
            attempted_location: locationText
          }

          response = getText(lang, {
            ms: `Hmm "${locationText}" tu kat mana ye? Kak Ani tak berapa cam.\n\nCuba tulis nama penuh tempat tu - contoh "Bandar Sri Damansara, Selangor" atau "Sungai Buloh".\n\nKalau kawasan perumahan, bagitahu nama bandar yang dekat.`,
            en: `Hmm not sure where "${locationText}" is exactly.\n\nCan you give me the full name? Like "Bandar Sri Damansara, Selangor" or "Sungai Buloh".\n\nIf it's a housing area, just tell me the nearest town.`,
            zh: `嗯，不太确定"${locationText}"在哪里。\n\n可以告诉我完整地名吗？比如"Bandar Sri Damansara, Selangor"或"Sungai Buloh"。\n\n如果是住宅区，告诉我最近的城镇就行。`
          })
          // Stay in collect_info, don't change step
        } else {
          // Got everything including coordinates - find jobs
          console.log('📝 collect_info: All fields complete, finding jobs...')

          // Find and present jobs
          const matchResult = await findAndPresentJobsConversational(updatedUser)

          // Set status to 'matching' BEFORE database update
          updatedUser.onboarding_status = 'matching'
          updatedUser.conversation_state = buildPostSearchState(matchResult)
          nextStep = 'viewing_jobs'

          console.log('📝 collect_info: Setting status to matching, jobs:', matchResult.jobs.length)

          const firstName = updatedUser.full_name?.split(' ')[0] || ''
          const jobCount = matchResult.jobs.length
          response = jobCount > 0
            ? getText(lang, {
                ms: `Okay ${firstName}, jap ye Kak Ani carikan...\n\nNi ${jobCount} kerja dekat dengan adik:\n\n${matchResult.message}`,
                en: `Alright ${firstName}, let me check...\n\nFound ${jobCount} jobs near you:\n\n${matchResult.message}`,
                zh: `好的${firstName}，让我找找...\n\n找到${jobCount}个附近的工作：\n\n${matchResult.message}`
              })
            : matchResult.message
        }
      } else {
        // Still missing some info - ask for it
        console.log('📝 collect_info: Asking for missing info...')
        response = askForMissingInfo(missing, lang, mergedInfo)
      }
      break

    // ========== STEP: UPDATE LOCATION ONLY ==========
    case 'update_location':
      console.log('📝 update_location: Extracting location only...')

      // Check if user is responding to ambiguous location prompt (reply with number)
      const updateLocConvState = user.conversation_state || {}
      if (updateLocConvState.ambiguous_location_pending && updateLocConvState.ambiguous_city && updateLocConvState.ambiguous_states) {
        const choiceNum = parseInt(message.trim())
        if (choiceNum >= 1 && choiceNum <= updateLocConvState.ambiguous_states.length) {
          // User chose a state number - combine city with chosen state
          const chosenState = updateLocConvState.ambiguous_states[choiceNum - 1]
          const cityWithState = `${updateLocConvState.ambiguous_city}, ${chosenState}`
          console.log(`📝 update_location: User chose state #${choiceNum} = ${chosenState}, geocoding "${cityWithState}"...`)

          // Re-extract with full location (city + state)
          const reExtracted = await extractAllInfo(cityWithState, lang)

          if (reExtracted.lat && reExtracted.lng) {
            updatedUser.location_city = reExtracted.city || updateLocConvState.ambiguous_city
            updatedUser.location_state = reExtracted.state || chosenState
            updatedUser.latitude = reExtracted.lat
            updatedUser.longitude = reExtracted.lng
            updatedUser.conversation_state = {} // Clear ambiguous state

            // Now find jobs
            const matchResult = await findAndPresentJobsConversational(updatedUser)
            updatedUser.onboarding_status = 'matching'
            updatedUser.conversation_state = buildPostSearchState(matchResult)
            nextStep = 'viewing_jobs'

            const firstName = updatedUser.full_name?.split(' ')[0] || ''
            const jobCount = matchResult.jobs.length
            response = jobCount > 0
              ? getText(lang, {
                  ms: `Ok ${firstName}, lokasi dah dikemaskini!\n\nNi ${jobCount} kerja dekat dengan adik:\n\n${matchResult.message}`,
                  en: `Ok ${firstName}, location updated!\n\nFound ${jobCount} jobs near you:\n\n${matchResult.message}`,
                  zh: `好的${firstName}，位置已更新！\n\n找到${jobCount}个附近的工作：\n\n${matchResult.message}`
                })
              : matchResult.message
            break
          } else {
            // Geocoding failed for chosen state - ask for more specific location
            console.log(`📝 update_location: Geocoding failed for "${cityWithState}", asking for more details...`)

            const firstName = updatedUser.full_name?.split(' ')[0] || ''
            updatedUser.conversation_state = {
              location_clarification_pending: true,
              attempted_city: updateLocConvState.ambiguous_city,
              attempted_state: chosenState
            }

            response = getText(lang, {
              ms: `Hmm "${updateLocConvState.ambiguous_city}, ${chosenState}" tu Kak Ani tak jumpa dalam peta.\n\n${firstName}, cuba bagitahu nama bandar besar yang dekat - contoh "Muar" atau "Batu Pahat"?`,
              en: `Hmm I couldn't find "${updateLocConvState.ambiguous_city}, ${chosenState}" on the map.\n\n${firstName}, can you tell me the nearest major town - like "Muar" or "Batu Pahat"?`,
              zh: `嗯，我在地图上找不到"${updateLocConvState.ambiguous_city}, ${chosenState}"。\n\n${firstName}，能告诉我最近的大城镇吗？比如"Muar"或"Batu Pahat"？`
            })
            break
          }
        }
      }

      // Check if user is providing location after clarification request
      if (updateLocConvState.location_clarification_pending) {
        console.log(`📝 update_location: Location clarification pending, extracting from "${message}"...`)

        let locationOnly = await extractAllInfo(message, lang)

        // FALLBACK: If no coordinates, try DB lookup directly
        // GPT might extract city="Klang" but no coords - we still need to look it up
        if (!locationOnly.lat || !locationOnly.lng) {
          const cityToLookup = locationOnly.city || message.trim()
          console.log(`📝 No coords from GPT, trying DB lookup for "${cityToLookup}"...`)
          const dbLookup = await lookupMalaysiaLocation(cityToLookup)
          if (dbLookup) {
            console.log(`✅ Found "${cityToLookup}" in malaysia_locations: ${dbLookup.state}`)
            locationOnly = {
              ...locationOnly,
              city: locationOnly.city || cityToLookup,
              state: dbLookup.state,
              lat: dbLookup.lat,
              lng: dbLookup.lng
            }
          }
        }

        if (locationOnly.lat && locationOnly.lng) {
          updatedUser.location_city = locationOnly.city
          updatedUser.location_state = locationOnly.state
          updatedUser.latitude = locationOnly.lat
          updatedUser.longitude = locationOnly.lng
          updatedUser.conversation_state = {} // Clear pending state

          const matchResult = await findAndPresentJobsConversational(updatedUser)
          updatedUser.onboarding_status = 'matching'
          updatedUser.conversation_state = buildPostSearchState(matchResult)
          nextStep = 'viewing_jobs'

          const firstName = updatedUser.full_name?.split(' ')[0] || ''
          const jobCount = matchResult.jobs.length
          response = jobCount > 0
            ? getText(lang, {
                ms: `Ok ${firstName}, lokasi dah dikemaskini ke ${locationOnly.city || locationOnly.state}!\n\nNi ${jobCount} kerja dekat dengan adik:\n\n${matchResult.message}`,
                en: `Ok ${firstName}, location updated to ${locationOnly.city || locationOnly.state}!\n\nFound ${jobCount} jobs near you:\n\n${matchResult.message}`,
                zh: `好的${firstName}，位置已更新为${locationOnly.city || locationOnly.state}！\n\n找到${jobCount}个附近的工作：\n\n${matchResult.message}`
              })
            : matchResult.message
          break
        } else {
          // Still can't geocode
          const firstName = updatedUser.full_name?.split(' ')[0] || ''
          response = getText(lang, {
            ms: `Hmm "${message}" tu pun Kak Ani tak jumpa.\n\n${firstName}, cuba bagitahu nama bandar yang lebih dikenali?`,
            en: `Hmm I couldn't find "${message}" either.\n\n${firstName}, can you try a more well-known town name?`,
            zh: `嗯，我也找不到"${message}"。\n\n${firstName}，能试试更知名的城镇名吗？`
          })
          break
        }
      }

      const locationExtracted = await extractAllInfo(message, lang)
      console.log('📝 update_location: Extracted:', JSON.stringify(locationExtracted))

      // Only update location fields
      if (locationExtracted.city) updatedUser.location_city = locationExtracted.city
      if (locationExtracted.state) updatedUser.location_state = locationExtracted.state
      if (locationExtracted.lat) updatedUser.latitude = locationExtracted.lat
      if (locationExtracted.lng) updatedUser.longitude = locationExtracted.lng

      // Check if we got location
      if (locationExtracted.city || locationExtracted.state) {
        // Check if location is ambiguous
        if (locationExtracted.ambiguous && locationExtracted.possible_states && locationExtracted.possible_states.length > 0) {
          console.log('📝 update_location: Ambiguous location detected')

          // Store ambiguous location info in conversation_state for when user replies with number
          const locationText = locationExtracted.city || locationExtracted.state
          updatedUser.location_city = undefined
          updatedUser.location_state = undefined
          updatedUser.latitude = undefined
          updatedUser.longitude = undefined
          updatedUser.conversation_state = {
            ...updatedUser.conversation_state,
            ambiguous_location_pending: true,
            ambiguous_city: locationText,
            ambiguous_states: locationExtracted.possible_states
          }

          response = getText(lang, {
            ms: `"${locationText}" ni ada kat beberapa tempat.\n\nAdik duduk kat negeri mana?\n${locationExtracted.possible_states.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nBalas nombor atau tulis nama penuh (contoh: "${locationText}, Selangor")`,
            en: `"${locationText}" exists in multiple areas.\n\nWhich state do you live in?\n${locationExtracted.possible_states.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nReply with the number or full name (e.g., "${locationText}, Selangor")`,
            zh: `"${locationText}"在多个地区都有。\n\n你住在哪个州？\n${locationExtracted.possible_states.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n回复数字或完整地名（如："${locationText}, Selangor"）`
          })
          // Stay in update_location step
        } else if (locationExtracted.lat && locationExtracted.lng) {
          // Got location with coordinates - proceed to job matching
          console.log('📝 update_location: Location complete, finding jobs...')

          const matchResult = await findAndPresentJobsConversational(updatedUser)

          updatedUser.onboarding_status = 'matching'
          updatedUser.conversation_state = buildPostSearchState(matchResult)
          nextStep = 'viewing_jobs'

          const firstName = updatedUser.full_name?.split(' ')[0] || ''
          const jobCount = matchResult.jobs.length
          response = jobCount > 0
            ? getText(lang, {
                ms: `Ok ${firstName}, lokasi dah dikemaskini!\n\nNi ${jobCount} kerja dekat dengan adik:\n\n${matchResult.message}`,
                en: `Ok ${firstName}, location updated!\n\nFound ${jobCount} jobs near you:\n\n${matchResult.message}`,
                zh: `好的${firstName}，位置已更新！\n\n找到${jobCount}个附近的工作：\n\n${matchResult.message}`
              })
            : matchResult.message
        } else {
          // Got location text but no coordinates - ask for clarification
          // DON'T save incomplete location to DB - clear it until user provides geocodable location
          const locationText = locationExtracted.city || locationExtracted.state
          updatedUser.location_city = undefined
          updatedUser.location_state = undefined
          updatedUser.latitude = undefined
          updatedUser.longitude = undefined

          // SET FLAG so next message only extracts location
          updatedUser.conversation_state = {
            location_clarification_pending: true,
            attempted_location: locationText
          }

          response = getText(lang, {
            ms: `Hmm "${locationText}" tu kat mana ye?\n\nCuba tulis nama penuh - contoh "Shah Alam, Selangor" atau "Petaling Jaya".`,
            en: `Hmm not sure where "${locationText}" is exactly.\n\nCan you give me the full name? Like "Shah Alam, Selangor" or "Petaling Jaya".`,
            zh: `嗯，不太确定"${locationText}"在哪里。\n\n可以告诉我完整地名吗？比如"Shah Alam, Selangor"。`
          })
          // Stay in update_location step
        }
      } else {
        // Didn't get any location - ask again
        response = getText(lang, {
          ms: `Tak faham tu. Cuba bagitahu Kak Ani lokasi adik sekarang.\n\nContoh: "Puchong, Selangor" atau "Johor Bahru"`,
          en: `Didn't catch that. Can you tell me where you live now?\n\nExample: "Puchong, Selangor" or "Johor Bahru"`,
          zh: `没听懂。可以告诉我你现在住在哪里吗？\n\n例如："Puchong, Selangor" 或 "Johor Bahru"`
        })
        // Stay in update_location step
      }
      break

    default:
      response = await generateKakAniResponse(
        user,
        message,
        `User dalam step "${step}" yang tak dikenali. Bantu mereka.`
      )
  }

  // Update user in database
  console.log('📝 handleOnboarding: Updating DB, nextStep:', nextStep)
  await updateUserInDB(user.id, updatedUser, nextStep)
  updatedUser.onboarding_step = nextStep

  console.log('📝 handleOnboarding: Returning response, length:', response.length)
  return { response, updatedUser }
}

// ============================================
// EXTRACT ALL INFO USING GPT-4o-mini (with geocoding)
// ============================================
// ============================================
// MALAYSIA LOCATION TABLE LOOKUP
// ============================================
async function lookupMalaysiaLocation(city: string, state?: string): Promise<{ lat: number, lng: number, state: string } | null> {
  try {
    // Normalize the city name for comparison
    let normalizedCity = city.trim().toLowerCase()

    // Common spelling alternatives / misspellings
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
      'subang': 'subang jaya',
      'damansara': 'petaling jaya',
      'kota damansara': 'petaling jaya',
      'ss2': 'petaling jaya',
      'ss15': 'subang jaya',
      'usj': 'subang jaya',
      'setia alam': 'shah alam',
      'setia city': 'shah alam'
    }

    // Apply spelling correction if match found
    if (spellingMap[normalizedCity]) {
      console.log(`📍 Spelling correction: "${normalizedCity}" → "${spellingMap[normalizedCity]}"`)
      normalizedCity = spellingMap[normalizedCity]
    }

    // Query the malaysia_locations table
    let query = supabase
      .from('malaysia_locations')
      .select('name, state, latitude, longitude')
      .ilike('name', normalizedCity)

    // If state is provided, filter by state too
    if (state) {
      query = query.ilike('state', state.trim())
    }

    const { data, error } = await query.limit(5)

    if (error) {
      console.error('❌ malaysia_locations lookup error:', error)
      return null
    }

    if (data && data.length > 0) {
      // If only one match, use it
      if (data.length === 1) {
        console.log(`📍 DB Lookup: Found "${data[0].name}" in ${data[0].state} (${data[0].latitude}, ${data[0].longitude})`)
        return {
          lat: parseFloat(data[0].latitude),
          lng: parseFloat(data[0].longitude),
          state: data[0].state
        }
      }

      // Multiple matches - if state was provided, we already filtered
      // Otherwise, return the first match but log the ambiguity
      console.log(`📍 DB Lookup: Found ${data.length} matches for "${city}", using first: ${data[0].state}`)
      return {
        lat: parseFloat(data[0].latitude),
        lng: parseFloat(data[0].longitude),
        state: data[0].state
      }
    }

    console.log(`📍 DB Lookup: "${city}" not found in malaysia_locations table`)
    return null
  } catch (error) {
    console.error('❌ malaysia_locations lookup exception:', error)
    return null
  }
}

async function extractAllInfo(message: string, lang: string): Promise<ExtractedInfo> {
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
      console.log(`✅ Using DB coordinates for "${merged.city}": (${dbLookup.lat}, ${dbLookup.lng})`)
      merged.lat = dbLookup.lat
      merged.lng = dbLookup.lng
      // Also update state if DB has it and we didn't have one
      if (!merged.state && dbLookup.state) {
        merged.state = dbLookup.state
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
// RULE-BASED INFO EXTRACTION (Fallback)
// ============================================
function extractInfoRuleBased(message: string): ExtractedInfo {
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
    const parts = message.split(/[,]+/)
    if (parts[0]) {
      const firstPart = parts[0].trim()
      const notNameWords = [
        // Greetings - should not be treated as names
        'hello', 'hi', 'hai', 'hey', 'helo', 'halo', 'yo', 'oi', 'woi', 'wei',
        // Common words
        'umur', 'age', 'tahun', 'lelaki', 'laki', 'perempuan', 'male', 'female', '男', '女',
        'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'lapan', 'sembilan', 'sepuluh',
        'puluh', 'puloh',
        // Random words that aren't names
        'test', 'testing', 'ok', 'okay', 'yes', 'no', 'ya', 'tidak', 'nak', 'mau', 'want',
        'kerja', 'job', 'cari', 'find', 'help', 'tolong', 'bantuan'
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

// ============================================
// HELPER: GET MISSING FIELDS
// ============================================
function getMissingFields(info: ExtractedInfo): string[] {
  const missing: string[] = []
  if (!info.name) missing.push('name')
  if (!info.age) missing.push('age')
  if (!info.gender) missing.push('gender')
  if (!info.city && !info.state) missing.push('location')
  return missing
}

// ============================================
// HELPER: ASK FOR MISSING INFO
// ============================================
function askForMissingInfo(missing: string[], lang: string, partial: ExtractedInfo): string {
  const got: string[] = []
  if (partial.name) got.push(lang === 'zh' ? `名字: ${partial.name}` : lang === 'en' ? `Name: ${partial.name}` : `Nama: ${partial.name}`)
  if (partial.age) got.push(lang === 'zh' ? `年龄: ${partial.age}` : lang === 'en' ? `Age: ${partial.age}` : `Umur: ${partial.age}`)
  if (partial.gender) {
    const g = partial.gender === 'male'
      ? (lang === 'zh' ? '男' : lang === 'en' ? 'Male' : 'Lelaki')
      : (lang === 'zh' ? '女' : lang === 'en' ? 'Female' : 'Perempuan')
    got.push(lang === 'zh' ? `性别: ${g}` : lang === 'en' ? `Gender: ${g}` : `Jantina: ${g}`)
  }
  if (partial.city) got.push(lang === 'zh' ? `地点: ${partial.city}` : lang === 'en' ? `Location: ${partial.city}` : `Lokasi: ${partial.city}`)

  const missingText: Record<string, { ms: string, en: string, zh: string }> = {
    name: { ms: 'nama', en: 'your name', zh: '名字' },
    age: { ms: 'umur', en: 'age', zh: '年龄' },
    gender: { ms: 'lelaki ke perempuan', en: 'male or female', zh: '男还是女' },
    location: { ms: 'duduk mana', en: 'where you live', zh: '住哪里' }
  }

  const missingList = missing.map(m => getText(lang, missingText[m])).join(', ')

  if (got.length > 0) {
    const gotStr = got.join('\n')
    return getText(lang, {
      ms: `Ok noted!\n${gotStr}\n\nEh tapi Kak Ani nak tahu lagi: ${missingList}`,
      en: `Got it!\n${gotStr}\n\nBut I still need to know: ${missingList}`,
      zh: `好的！\n${gotStr}\n\n不过我还想知道：${missingList}`
    })
  }

  return getText(lang, {
    ms: `Eh tak faham la tu. Cuba bagitahu Kak Ani:\n- Nama adik\n- Umur berapa\n- Lelaki ke perempuan\n- Duduk kat mana\n\nContoh: "Ali, 25, lelaki, Puchong"`,
    en: `Hmm didn't quite get that. Can you tell me:\n- Your name\n- How old you are\n- Male or female\n- Where you live\n\nLike: "Ali, 25, male, Puchong"`,
    zh: `嗯，没太听懂。可以告诉我：\n- 你的名字\n- 多大了\n- 男还是女\n- 住在哪里\n\n比如："Ali, 25, 男, Puchong"`
  })
}

// ============================================
// COMPLETED USER - CONVERSATIONAL
// ============================================
async function handleCompletedUserConversational(
  user: User,
  message: string
): Promise<{ response: string, updatedUser: User }> {

  const lang = user.preferred_language || 'ms'
  const firstName = user.full_name?.split(' ')[0] || ''

  const wantsSearch = await detectJobSearchIntent(message, lang)

  if (wantsSearch) {
    const result = await findAndPresentJobsConversational(user)

    const updatedUser = {
      ...user,
      onboarding_status: 'matching',
      conversation_state: buildPostSearchState(result)
    }

    await updateUserInDB(user.id, updatedUser, 'viewing_jobs')

    const jobCount = result.jobs.length
    return {
      response: jobCount > 0
        ? getText(lang, {
            ms: `Jumpa ${jobCount} kerja sesuai!\n\n${result.message}`,
            en: `Found ${jobCount} matching jobs!\n\n${result.message}`,
            zh: `找到${jobCount}个合适的工作！\n\n${result.message}`
          })
        : result.message,
      updatedUser
    }
  }

  const response = getText(lang, {
    ms: `Hai ${firstName}!\n\nNak cari kerja baru? Cakap je "cari kerja" dan Kak Ani tolong carikan.`,
    en: `Hi ${firstName}!\n\nWant to find a new job? Just say "find job" and I'll help you search.`,
    zh: `你好 ${firstName}！\n\n想找新工作吗？说"找工作"，我帮你找。`
  })

  return { response, updatedUser: user }
}

// ============================================
// MATCHING STATE - WITH RUNNING JOB NUMBERS
// ============================================
async function handleMatchingConversational(
  user: User,
  message: string
): Promise<{ response: string, updatedUser: User }> {

  console.log(`🎯 handleMatchingConversational: message="${message}"`)

  const lang = user.preferred_language || 'ms'
  const convState = user.conversation_state || {}
  const matchedJobs: MatchedJob[] = convState.matched_jobs || []
  const currentIndex = convState.current_job_index || 0

  console.log(`🎯 Jobs in state: ${matchedJobs.length}, currentIndex: ${currentIndex}`)

  // ===== EXPAND SEARCH HANDLER =====
  if (convState.expand_search_pending) {
    const lower = message.toLowerCase().trim()
    const isYes = /^(ya|yes|ok|okay|1|是|boleh|nak|want|yep|yup|sure)$/i.test(lower)
    const isNo = /^(tidak|tak|no|2|不|不是|nope|nah|taknak|don't)$/i.test(lower)

    if (isYes) {
      const currentRadius = convState.current_radius || 10
      const nextRadius = currentRadius < 20 ? 20 : 50
      console.log(`🔍 Expanding search from ${currentRadius}km to ${nextRadius}km`)

      // Re-search at the new radius
      const expandResult = await findAndPresentJobsConversational(user, nextRadius)

      if (expandResult.jobs.length > 0) {
        // Found jobs at expanded radius
        const newState = {
          matched_jobs: expandResult.jobs,
          current_job_index: 0
        }
        await supabase.from('applicants').update({
          conversation_state: newState,
          updated_at: new Date().toISOString()
        }).eq('id', user.id)

        const firstName = user.full_name?.split(' ')[0] || ''
        const resp = getText(lang, {
          ms: `Jumpa ${expandResult.jobs.length} kerja dalam radius ${nextRadius}km!\n\n${expandResult.message}`,
          en: `Found ${expandResult.jobs.length} jobs within ${nextRadius}km!\n\n${expandResult.message}`,
          zh: `在${nextRadius}公里内找到${expandResult.jobs.length}个工作！\n\n${expandResult.message}`
        })
        return { response: resp, updatedUser: { ...user, conversation_state: newState } }
      } else if (expandResult.noJobsAtRadius && nextRadius < 50) {
        // Still no jobs, ask to expand further
        const newState = {
          expand_search_pending: true,
          current_radius: nextRadius,
          scored_jobs: expandResult.allScoredJobs || convState.scored_jobs || []
        }
        await supabase.from('applicants').update({
          conversation_state: newState,
          updated_at: new Date().toISOString()
        }).eq('id', user.id)
        return { response: expandResult.message, updatedUser: { ...user, conversation_state: newState } }
      } else {
        // Final tier or 50km with no jobs
        await supabase.from('applicants').update({
          conversation_state: {},
          onboarding_status: 'completed',
          updated_at: new Date().toISOString()
        }).eq('id', user.id)
        return { response: expandResult.message, updatedUser: { ...user, onboarding_status: 'completed', conversation_state: {} } }
      }
    } else if (isNo) {
      // User declined expansion
      await supabase.from('applicants').update({
        conversation_state: {},
        onboarding_status: 'completed',
        updated_at: new Date().toISOString()
      }).eq('id', user.id)

      const resp = getText(lang, {
        ms: `Ok takpe. Balas 'semula' bila nak cari kerja kat lokasi lain ye.`,
        en: `No problem. Reply 'restart' when you want to search in a different location.`,
        zh: `没关系。回复"重新开始"可以搜索其他位置。`
      })
      return { response: resp, updatedUser: { ...user, onboarding_status: 'completed', conversation_state: {} } }
    }
    // If neither yes nor no, fall through to normal handling
  }

  // Handle edge case: no jobs in state (user may have arrived here incorrectly)
  if (matchedJobs.length === 0) {
    console.log('⚠️ No jobs in conversation state, redirecting to job search')
    const firstName = user.full_name?.split(' ')[0] || ''
    const response = getText(lang, {
      ms: `Hai ${firstName}! Tak ada kerja dalam senarai. Cakap "cari kerja" untuk mula cari.`,
      en: `Hi ${firstName}! No jobs in your list. Say "find job" to start searching.`,
      zh: `你好 ${firstName}！列表里没有工作。说"找工作"开始搜索。`
    })
    return { response, updatedUser: user }
  }

  // Calculate valid range for current page
  const pageStart = currentIndex + 1
  const pageEnd = Math.min(currentIndex + 3, matchedJobs.length)

  // Try to extract job selection - ACCEPT ANY VALID JOB NUMBER (running numbers)
  const selection = extractJobNumber(message, matchedJobs.length)

  if (selection !== null) {
    // User selected a job by running number
    const jobIndex = selection - 1 // Convert 1-based to 0-based
    const selectedJob = matchedJobs[jobIndex]

    if (selectedJob) {
      // Simple apply URL (no JWT token needed)
      const applyUrl = selectedJob.url || `${AGENCY_BASE_URL}/${selectedJob.id}`

      const location = [selectedJob.location_city, selectedJob.location_state].filter(Boolean).join(', ')
      const salary = selectedJob.salary_range || getText(lang, { ms: 'Gaji negotiate', en: 'Salary negotiable', zh: '薪资面议' })

      // Save job selection to database
      await saveJobSelection(user.id, selectedJob, applyUrl)

      // Update user status
      await supabase.from('applicants').update({
        onboarding_status: 'completed',
        conversation_state: {},
        updated_at: new Date().toISOString()
      }).eq('id', user.id)

      const displayTitle = selectedJob.external_job_id ? `${selectedJob.title} (${selectedJob.external_job_id})` : selectedJob.title

      const response = getText(lang, {
ms: `Best! Adik pilih:\n\n*${displayTitle}* di *${selectedJob.company}*\n📍 ${location}\n💰 ${salary}\n\n👉 Klik untuk daftar: ${applyUrl}\n\n⚠️ *PENTING:* Pilih kat sini baru langkah pertama! Adik WAJIB klik link dan daftar kat website untuk lengkapkan permohonan.\n\nBalas 'semula' nak cari kerja lain.`,
        en: `Great choice!\n\n*${displayTitle}* at *${selectedJob.company}*\n📍 ${location}\n💰 ${salary}\n\n👉 Click to register: ${applyUrl}\n\n⚠️ *IMPORTANT:* Selecting here is just the first step! You MUST click the link and register on the website to complete your application.\n\nReply 'restart' to find more jobs.`,
        zh: `好选择！\n\n*${selectedJob.company}* 的 *${displayTitle}*\n📍 ${location}\n💰 ${salary}\n\n👉 点击注册：${applyUrl}\n\n⚠️ *重要：* 在这里选择只是第一步！您必须点击链接并在网站上注册才能完成申请。\n\n回复「重新开始」找更多工作。`
      })

      return {
        response,
        updatedUser: { ...user, onboarding_status: 'completed', conversation_state: {} }
      }
    }
  }

  // Check for "more" / "lagi" command
  const isMore = isMoreCommand(message)
  console.log(`🎯 isMoreCommand("${message}"): ${isMore}`)

  if (isMore) {
    let newIndex = currentIndex + 3

    // Check if we've reached the end of the list
    if (newIndex >= matchedJobs.length) {
      // Show end-of-list message instead of cycling
      const endMessage = getText(lang, {
        ms: `Dah habis senarai kerja! Adik dah tengok semua ${matchedJobs.length} kerja yang ada.\n\nNak buat apa?\n• Balas nombor (1-${matchedJobs.length}) untuk mohon mana-mana kerja\n• Balas 'semula' untuk cari semula dari awal`,
        en: `That's all the jobs! You've seen all ${matchedJobs.length} available jobs.\n\nWhat would you like to do?\n• Reply with a number (1-${matchedJobs.length}) to apply for any job\n• Reply 'restart' to search again from the beginning`,
        zh: `已经看完所有工作了！您已浏览了全部${matchedJobs.length}个职位。\n\n您想要：\n• 回复数字（1-${matchedJobs.length}）申请任何工作\n• 回复「重新开始」从头搜索`
      })
      return {
        response: endMessage,
        updatedUser: user
      }
    }

    const newConvState = { ...convState, current_job_index: newIndex }
    await supabase.from('applicants').update({
      conversation_state: newConvState,
      updated_at: new Date().toISOString()
    }).eq('id', user.id)

    const jobsMessage = formatJobsMessage(matchedJobs, newIndex, lang)
    return {
      response: jobsMessage,
      updatedUser: { ...user, conversation_state: newConvState }
    }
  }

  // Invalid input - show help
  const response = getText(lang, {
    ms: `Balas nombor (${pageStart}-${pageEnd}) untuk memohon, atau 'lagi' untuk pilihan lain.`,
    en: `Reply with a number (${pageStart}-${pageEnd}) to apply, or 'more' for more options.`,
    zh: `回复数字（${pageStart}-${pageEnd}）申请，或「更多」查看更多。`
  })

  return { response, updatedUser: user }
}

// ============================================
// EXTRACT JOB NUMBER (Running numbers)
// ============================================
function extractJobNumber(message: string, maxJobs: number): number | null {
  const lower = message.toLowerCase().trim()

  // Try direct number
  const num = parseInt(lower)
  if (!isNaN(num) && num >= 1 && num <= maxJobs) {
    return num
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
function isMoreCommand(message: string): boolean {
  const lower = message.toLowerCase().trim()
  const moreWords = ['more', 'lagi', '更多', 'next', 'seterusnya', 'lain']
  return moreWords.includes(lower) || moreWords.some(w => lower.startsWith(w))
}

// ============================================
// GEOCODE USER LOCATION (for returning users without coordinates)
// ============================================
async function geocodeUserLocation(user: User): Promise<{ lat: number | null, lng: number | null }> {
  const locationText = [user.location_city, user.location_state].filter(Boolean).join(', ')
  if (!locationText) return { lat: null, lng: null }

  console.log(`🗺️ Geocoding location for returning user: "${locationText}"`)

  try {
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
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

// ============================================
// JOB MATCHING - SIMPLIFIED
// ============================================
async function findAndPresentJobsConversational(user: User, radiusKm: number = 10): Promise<{ message: string, jobs: MatchedJob[], noJobsAtRadius?: number, allScoredJobs?: Array<{ jobId: string, distance: number }> }> {
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
      }),
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
      }),
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
    external_job_id: s.job.external_job_id
  }))

  const message = formatJobsMessage(topJobs, 0, lang)

  return { message, jobs: topJobs }
}

// ============================================
// HELPER: Build conversation state after job search
// ============================================
function buildPostSearchState(matchResult: { jobs: MatchedJob[], noJobsAtRadius?: number, allScoredJobs?: Array<{ jobId: string, distance: number }> }): Record<string, any> {
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
function formatJobsMessage(jobs: MatchedJob[], startIndex: number, language: string): string {
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
    message += `📍 ${l.location}: ${location}\n`
    message += `💰 ${l.salary}: ${salary}\n\n`
  })

  message += l.reply(firstJobNumber, lastJobNumber, hasMore)

  return message
}

// ============================================
// DATABASE UPDATE
// ============================================
async function updateUserInDB(userId: string, user: User, nextStep: string) {
  const updateData: Record<string, any> = {
    onboarding_step: nextStep,
    updated_at: new Date().toISOString()
  }

  if (user.preferred_language) updateData.preferred_language = user.preferred_language
  if (user.full_name) updateData.full_name = user.full_name
  if (user.age) updateData.age = user.age
  if (user.gender) updateData.gender = user.gender
  if (user.location_city) updateData.location_city = user.location_city
  if (user.location_state) updateData.location_state = user.location_state
  if (user.latitude) updateData.latitude = user.latitude
  if (user.longitude) updateData.longitude = user.longitude
  if (user.onboarding_status) updateData.onboarding_status = user.onboarding_status
  if (user.conversation_state) updateData.conversation_state = user.conversation_state

  const { error } = await supabase
    .from('applicants')
    .update(updateData)
    .eq('id', userId)

  if (error) {
    console.error('User update failed:', error)
  }
}

// ============================================
// GPT HELPER
// ============================================
async function generateKakAniResponse(
  user: User,
  userMessage: string,
  contextInstruction: string
): Promise<string> {

  const messages: GPTMessage[] = [
    { role: 'system', content: KAK_ANI_SYSTEM_PROMPT },
    { role: 'system', content: `Context: ${contextInstruction}` },
    { role: 'user', content: userMessage }
  ]

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 300,
        temperature: 0.7
      })
    })

    const result = await response.json()
    return result.choices?.[0]?.message?.content || "Maaf, ada masalah. Cuba lagi ye?"

  } catch (error) {
    console.error('GPT API error:', error)
    return "Alamak ada masalah teknikal. Cuba lagi sekejap ye?"
  }
}

// ============================================
// EXTRACTION FUNCTIONS
// ============================================
async function extractLanguageChoice(message: string): Promise<string | null> {
  const lower = message.toLowerCase().trim().replace(/[!?.,:;]+$/, '')

  const bmWords = ['melayu', 'malaysia', 'malay', 'bm', 'bahasa', '1', 'satu', 'first']
  const enWords = ['english', 'eng', 'en', 'inggeris', 'bi', '2', 'dua', 'two']
  const zhWords = ['chinese', 'cina', 'mandarin', 'zh', '中文', '华语', '3', 'tiga', 'three']

  if (bmWords.includes(lower)) return 'ms'
  if (enWords.includes(lower)) return 'en'
  if (zhWords.includes(lower)) return 'zh'

  if (/[\u4e00-\u9fff]/.test(message)) return 'zh'

  for (const word of bmWords) { if (lower.includes(word)) return 'ms' }
  for (const word of enWords) { if (lower.includes(word)) return 'en' }
  for (const word of zhWords) { if (lower.includes(word)) return 'zh' }

  return null
}

async function detectJobSearchIntent(message: string, lang: string): Promise<boolean> {
  const lower = message.toLowerCase()
  const searchWords = ['cari', 'kerja', 'job', 'keje', 'find', 'search', '找工作', '工作', 'pekerjaan']
  return searchWords.some(word => lower.includes(word))
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let token = ''
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

// ============================================
// THANOS EASTER EGG - RESET USER STATE
// ============================================
async function handleThanosReset(user: User): Promise<{ response: string, updatedUser: User }> {
  console.log(`💎 THANOS SNAP: Resetting user ${user.id}`)

  const { error } = await supabase
    .from('applicants')
    .update({
      onboarding_status: 'new',
      onboarding_step: null,
      conversation_state: null,
      full_name: null,
      ic_number: null,
      age: null,
      gender: null,
      preferred_language: null,
      location_city: null,
      location_state: null,
      preferred_job_types: null,
      preferred_positions: null,
      years_experience: null,
      has_transport: null,
      is_oku: null,
      latitude: null,
      longitude: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id)

  if (error) {
    console.error('Thanos snap failed:', error)
    return {
      response: "The stones failed... Try again.",
      updatedUser: user
    }
  }

  const resetUser: User = {
    id: user.id,
    phone_number: user.phone_number,
    onboarding_status: 'new'
  }

  return {
    response: `*snap* 💎

I am inevitable...

Your profile has been reduced to atoms.
Perfectly balanced, as all things should be.

Send any message to start fresh.`,
    updatedUser: resetUser
  }
}

function jsonResponse(data: any): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  })
}
