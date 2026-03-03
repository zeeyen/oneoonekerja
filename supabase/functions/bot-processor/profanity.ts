// profanity.ts — Profanity filter and violation/ban system

import { supabase } from './config.ts'
import { getText } from './helpers.ts'
import type { User } from './types.ts'

// ============================================
// PROFANITY FILTER (English, Malay, Mandarin)
// ============================================
export const PROFANITY_PATTERNS = [
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

export const PROFANITY_WARNINGS = {
  ms: `Eh adik, semua chat ni direkod tau. Tolong jangan guna bahasa kasar ye. Nak cari kerja apa hari ni?`,
  en: `Please note that all conversations are recorded. Kindly avoid using inappropriate language. How can I help you find a job today?`,
  zh: `请注意，所有对话都会被记录。请不要使用不当语言。我能帮您找什么工作？`
}

export function containsProfanity(message: string): boolean {
  return PROFANITY_PATTERNS.some(pattern => pattern.test(message))
}

// ============================================
// VIOLATION TRACKING & BAN SYSTEM
// ============================================
export async function handleProfanityViolation(user: User, message: string): Promise<{ response: string, updatedUser: User }> {
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
      ms: `🚫 *Akaun Disekat 72 Jam*\n\nIni kali ke-4 adik melanggar peraturan. Akaun disekat selama 3 hari.\n\nSila hubungi kami di support@101kerja.com jika ada pertanyaan.`,
      en: `🚫 *Account Suspended 72 Hours*\n\nThis is your 4th violation. Your account is suspended for 3 days.\n\nPlease contact us at support@101kerja.com if you have questions.`,
      zh: `🚫 *账户被封禁72小时*\n\n这是您第4次违规。您的账户被封禁3天。\n\n如有疑问请联系 support@101kerja.com。`
    })
  } else {
    // Fifth+ violation: 7-day ban (or permanent for repeat offenders)
    const banDays = Math.min(7 * (currentViolations - 4), 30) // Cap at 30 days
    banUntil = new Date(Date.now() + banDays * 24 * 60 * 60 * 1000)
    banReason = `Penggunaan bahasa tidak sesuai berulang kali (${currentViolations} kali)`
    response = getText(lang, {
      ms: `🚫 *Akaun Disekat ${banDays} Hari*\n\nAdik telah melanggar peraturan ${currentViolations} kali. Akaun disekat selama ${banDays} hari.\n\nHubungi kami di support@101kerja.com untuk rayuan.`,
      en: `🚫 *Account Suspended ${banDays} Days*\n\nYou have violated our guidelines ${currentViolations} times. Your account is suspended for ${banDays} days.\n\nContact us at support@101kerja.com to appeal.`,
      zh: `🚫 *账户被封禁${banDays}天*\n\n您已违规${currentViolations}次。您的账户被封禁${banDays}天。\n\n请联系 support@101kerja.com 申诉。`
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
