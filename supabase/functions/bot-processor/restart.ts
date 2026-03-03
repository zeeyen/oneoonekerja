import { supabase } from './config.ts'
import { getText } from './helpers.ts'
import type { User } from './types.ts'
import { extractAllInfo } from './extraction.ts'
import { getUserJobSelections, formatJobSelectionsMessage } from './job-selections.ts'
import { findAndPresentJobsConversational, buildPostSearchState } from './jobs.ts'
import { handleNewUserConversational, handleOnboardingConversational } from './onboarding.ts'

// ============================================
// RESTART COMMAND DETECTION (with language detection)
// ============================================
export function detectRestartCommand(message: string): { isRestart: boolean, detectedLang: string | null } {
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
export function isRestartCommand(message: string): boolean {
  return detectRestartCommand(message).isRestart
}

export async function handleRestart(user: User): Promise<{ response: string, updatedUser: User }> {
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
export async function handleRestartLocationChoice(user: User, message: string): Promise<{ response: string, updatedUser: User }> {
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

  // Recovery: user may send city/state directly instead of menu number.
  const directLocation = await extractAllInfo(message, lang)
  if (directLocation.city || directLocation.state) {
    console.log('📍 Restart menu: detected direct location input, routing to update_location flow')
    const transitionUser: User = {
      ...user,
      onboarding_status: 'in_progress',
      onboarding_step: 'update_location',
      conversation_state: { updating_location_only: true },
      location_city: undefined,
      location_state: undefined,
      latitude: undefined,
      longitude: undefined
    }
    return await handleOnboardingConversational(transitionUser, message, 'update_location')
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
