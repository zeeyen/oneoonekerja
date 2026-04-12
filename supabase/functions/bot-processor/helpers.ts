// helpers.ts — Pure helper functions (no DB, no side effects)

export function getTimeBasedGreeting(): { ms: string, en: string, zh: string } {
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

export function getText(lang: string, texts: { ms: string, en: string, zh: string }): string {
  if (lang === 'zh') return texts.zh
  if (lang === 'en') return texts.en
  return texts.ms
}

// ============================================
// LANGUAGE MIRRORING HELPERS
// ============================================
export function normalizeLooseText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

export function isLowSignalMessage(message: string): boolean {
  const lower = normalizeLooseText(message).replace(/[!?.,:;]+$/g, '')
  if (!lower) return true
  if (/^[\d\s]+$/.test(lower)) return true
  if (/^[^\w\u4e00-\u9fff]+$/i.test(lower)) return true
  const lowSignalTokens = new Set([
    'ok', 'okay', 'k', 'kk', 'ya', 'yes', 'y', 'no', 'tak', 'tidak', 'x', 'hmm',
    'lagi', 'more', 'semula', 'restart', 'hi', 'hello', 'hai', 'helo', '1', '2', '3'
  ])
  return lowSignalTokens.has(lower)
}

// Common English loanwords used in Malay context — these should NOT flip language to English
const MALAY_LOANWORDS = new Set([
  'part time', 'full time', 'part-time', 'full-time', 'job', 'ok', 'okay',
  'factory', 'warehouse', 'hostel', 'shift', 'overtime', 'ot', 'salary',
  'company', 'apply', 'register', 'link', 'website', 'online', 'code',
  'referral', 'scam', 'interview', 'resume', 'email', 'phone', 'whatsapp',
  'area', 'location', 'address', 'transport', 'bus', 'grab', 'mrt', 'lrt'
])

export function detectMessageLanguage(message: string): string | null {
  if (!message || isLowSignalMessage(message)) return null
  if (/[\u4e00-\u9fff]/.test(message)) return 'zh'

  const lower = normalizeLooseText(message)
  
  // Remove loanwords before scoring to avoid false English detection
  let cleanedForScoring = lower
  for (const loanword of MALAY_LOANWORDS) {
    cleanedForScoring = cleanedForScoring.replace(new RegExp(`\\b${loanword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '')
  }
  cleanedForScoring = cleanedForScoring.trim()

  const msWords = ['saya', 'nama', 'umur', 'lelaki', 'perempuan', 'duduk', 'kat', 'dekat', 'nak', 'kerja', 'tak', 'boleh', 'lokasi', 'mana', 'kampung', 'bagitahu', 'ada', 'nie', 'ni', 'tu', 'ye', 'la', 'lah', 'kan', 'ke', 'atau', 'macam']
  const enWords = ['i ', 'my ', 'name is', 'age is', 'where', 'find', 'please', 'can you', 'would', 'could', 'should', 'looking for', 'i want', 'i need', 'thank you', 'thanks']

  const scoreWords = (words: string[], text: string) => words.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0)
  const msScore = scoreWords(msWords, lower) // Score Malay against original (includes particles like ni, tu, lah)
  const enScore = scoreWords(enWords, cleanedForScoring) // Score English against cleaned text

  if (msScore === 0 && enScore === 0) return null
  
  // Require stronger English signal: at least 2 more English words than Malay
  if (enScore >= msScore + 2) return 'en'
  if (msScore > 0) return 'ms'
  
  return null
}

export function resolveMirroredLanguage(message: string, currentLang: string = 'ms'): string {
  const detected = detectMessageLanguage(message)
  return detected || currentLang || 'ms'
}

// ============================================
// ESCALATION FOOTER — Human contact info
// ============================================
// ============================================
// TRACKING URL — Append source params for attribution
// ============================================
export function appendTracking(url: string, userId: string): string {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}source=chatbot&source_id=${userId}`
}

export function getEscalationFooter(lang: string): string {
  return getText(lang, {
    ms: `\n\nKalau ada apa-apa, boleh je WhatsApp kitorang ye:\n📱 wa.me/60162066861\n📧 info@101kerja.com`,
    en: `\n\nIf you need anything, just reach out to us anytime:\n📱 wa.me/60162066861\n📧 info@101kerja.com`,
    zh: `\n\n有什么需要随时联系我们哦：\n📱 wa.me/60162066861\n📧 info@101kerja.com`
  })
}
