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

export function detectMessageLanguage(message: string): string | null {
  if (!message || isLowSignalMessage(message)) return null
  if (/[\u4e00-\u9fff]/.test(message)) return 'zh'

  const lower = normalizeLooseText(message)
  const msWords = ['saya', 'nama', 'umur', 'lelaki', 'perempuan', 'duduk', 'kat', 'dekat', 'nak', 'kerja', 'tak', 'boleh', 'lokasi', 'mana', 'kampung', 'bagitahu']
  const enWords = ['i ', 'my', 'name', 'age', 'male', 'female', 'where', 'job', 'find', 'location', 'full time', 'part time', 'please', 'can you']

  const scoreWords = (words: string[]) => words.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0)
  const msScore = scoreWords(msWords)
  const enScore = scoreWords(enWords)

  if (msScore === 0 && enScore === 0) return null
  if (Math.abs(msScore - enScore) <= 0) return null
  return msScore > enScore ? 'ms' : 'en'
}

export function resolveMirroredLanguage(message: string, currentLang: string = 'ms'): string {
  const detected = detectMessageLanguage(message)
  return detected || currentLang || 'ms'
}
