// session.ts — Session timeout check

import { SESSION_TIMEOUT_MS, supabase } from './config.ts'
import { getText } from './helpers.ts'
import type { User } from './types.ts'
import { extractAllInfo } from './extraction.ts'
import { getUserJobSelections, formatJobSelectionsMessage } from './job-selections.ts'
import { handleOnboardingConversational } from './onboarding.ts'

export function checkSessionTimeout(user: User): boolean {
  if (!user.last_active_at) return false

  const lastActive = new Date(user.last_active_at).getTime()
  const now = Date.now()
  const timeSinceLastMessage = now - lastActive

  return timeSinceLastMessage > SESSION_TIMEOUT_MS
}

export async function handleSessionExpired(user: User, message: string): Promise<{ response: string, updatedUser: User }> {
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

    // Recovery: user may send location directly instead of replying 1/2.
    const directLocation = await extractAllInfo(message, lang)
    if (directLocation.city || directLocation.state) {
      console.log('📍 Session-expired menu: detected direct location input, routing to update_location flow')
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
