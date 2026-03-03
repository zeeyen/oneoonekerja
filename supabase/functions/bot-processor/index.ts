// Supabase Edge Function: bot-processor (Enhanced Version v2)
// 101Kerja WhatsApp Bot powered by GPT-4o-mini
// Personality: Kak Ani - friendly kakak helping B40s find work
// ENHANCED FLOW: BM-first → All Info → Jobs (no confirmation step)
// Features: Running job numbers, per-turn language mirroring, session timeout
// Deploy: supabase functions deploy bot-processor --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Module imports — only what the serve() entry point needs
import { supabase } from './config.ts'
import type { ProcessRequest } from './types.ts'
import { getText, resolveMirroredLanguage } from './helpers.ts'
import { containsProfanity, handleProfanityViolation } from './profanity.ts'
import { handleThanosReset, jsonResponse, updateUserInDB } from './db.ts'
import { checkSessionTimeout, handleSessionExpired } from './session.ts'
import { detectShortcode, handleShortcodeSearch } from './shortcode.ts'
import { detectLanguageChangeCommand, processWithKakAni } from './router.ts'
import { handleRestartLocationChoice } from './restart.ts'

// ============================================
// MAIN HANDLER
// ============================================
serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // Note: META_APP_SECRET validation removed — the upstream webhook handler
    // already validates the Meta webhook signature. This internal endpoint
    // is called by our own webhook handler, not directly by Meta.

    const { user, message, messageType, locationData }: ProcessRequest = await req.json()

    // Mirror applicant language per turn (with low-signal guard to avoid random flips).
    const previousLang = user.preferred_language || 'ms'
    const mirroredLang = resolveMirroredLanguage(message, previousLang)
    user.preferred_language = mirroredLang
    if (mirroredLang !== previousLang) {
      await supabase.from('applicants').update({
        preferred_language: mirroredLang,
        updated_at: new Date().toISOString()
      }).eq('id', user.id)
    }

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

    // Keep explicit language switch command for user control (optional).
    const langChangeResult = detectLanguageChangeCommand(message)
    if (langChangeResult && user.onboarding_status !== 'new') {
      const updatedUser = { ...user, preferred_language: langChangeResult }
      await updateUserInDB(user.id, updatedUser, user.onboarding_step || 'collect_info')
      const langChangedMessages = {
        en: "Language changed to English. How can I help you find a job?",
        ms: "Ok dah tukar ke Bahasa Malaysia. Nak cari kerja apa?",
        zh: "语言已切换为中文。我能帮您找什么工作？"
      }
      return jsonResponse({ response: langChangedMessages[langChangeResult as keyof typeof langChangedMessages], updatedUser })
    }

    // Check for shortcode commands (geo-xxxx / com-xxxx) - BEFORE session timeout
    const shortcode = detectShortcode(message)
    if (shortcode) {
      console.log(`🔗 Shortcode detected: ${shortcode.type}-${shortcode.slug}`)
      const result = await handleShortcodeSearch(user, shortcode.type, shortcode.slug)
      return jsonResponse(result)
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
