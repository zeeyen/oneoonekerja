import { supabase } from './config.ts'
import { getText } from './helpers.ts'
import type { User, ExtractedInfo, MatchedJob } from './types.ts'
import { calculateDistance } from './location.ts'
import { getMissingFields } from './missing-fields.ts'
import { generateKakAniResponse } from './gpt.ts'
import { findAndPresentJobsConversational, buildPostSearchState } from './jobs.ts'
import { detectRestartCommand, handleRestart } from './restart.ts'
import { handleNewUserConversational, handleOnboardingConversational } from './onboarding.ts'
import { handleCompletedUserConversational } from './completed.ts'
import { handleMatchingConversational } from './matching.ts'

// ============================================
// DETECT LANGUAGE CHANGE COMMAND
// ============================================
export function detectLanguageChangeCommand(message: string): string | null {
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
// SHORTCODE CONTEXT PRESERVATION HELPER
// ============================================
export function preserveShortcodeContext(existingState: Record<string, any>, newState: Record<string, any>): Record<string, any> {
  if (existingState?.shortcode_jobs) {
    newState.shortcode_jobs = existingState.shortcode_jobs
    newState.shortcode_type = existingState.shortcode_type
  }
  if (existingState?.last_image_at) {
    newState.last_image_at = existingState.last_image_at
  }
  if (existingState?.profile_slots && !newState.profile_slots) {
    newState.profile_slots = existingState.profile_slots
  }
  if (existingState?.recent_messages && !newState.recent_messages) {
    newState.recent_messages = existingState.recent_messages
  }
  return newState
}

// ============================================
// REVERSE GEOCODE HELPER (using malaysia_locations table)
// ============================================
export async function reverseGeocode(lat: number, lng: number): Promise<{ city: string, state: string } | null> {
  try {
    const { data, error } = await supabase
      .from('malaysia_locations')
      .select('name, state, latitude, longitude')
      .limit(500)

    if (error || !data || data.length === 0) {
      console.error('reverseGeocode: DB query failed:', error)
      return null
    }

    let nearestDist = Infinity
    let nearest: { city: string, state: string } | null = null

    for (const loc of data) {
      const dist = calculateDistance(lat, lng, parseFloat(loc.latitude as any), parseFloat(loc.longitude as any))
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = { city: loc.name, state: loc.state }
      }
    }

    if (nearest && nearestDist < 100) {
      console.log(`📍 reverseGeocode: (${lat}, ${lng}) → ${nearest.city}, ${nearest.state} (${Math.round(nearestDist)}km)`)
      return nearest
    }

    console.log(`📍 reverseGeocode: No location within 100km of (${lat}, ${lng})`)
    return null
  } catch (e) {
    console.error('reverseGeocode error:', e)
    return null
  }
}

// ============================================
// IMAGE / SELECTION INTENT DETECTION
// ============================================
export function isSelectionIntent(message: string): boolean {
  return /^(sy\s*n[ak]\s*ni|saya\s*nak\s*(ni|ini)|i\s*want\s*this|ni\s*la|nak\s*(ni|ini)|this\s*one|我要这个|ni|ini)$/i.test(message.toLowerCase().trim())
}

// ============================================
// KAK ANI CONVERSATION PROCESSOR
// ============================================
export async function processWithKakAni(
  user: User,
  message: string,
  messageType: string,
  locationData: any
): Promise<{ response: string, updatedUser: User }> {

  const step = user.onboarding_step || 'welcome'
  const lang = user.preferred_language || 'ms'

  // ===== HANDLE WHATSAPP LOCATION SHARING =====
  if (messageType === 'location' && locationData && locationData.latitude && locationData.longitude) {
    const lat = parseFloat(locationData.latitude)
    const lng = parseFloat(locationData.longitude)
    console.log(`📍 WhatsApp location shared: (${lat}, ${lng})`)

    const geoResult = await reverseGeocode(lat, lng)
    const cityName = geoResult?.city || 'Unknown'
    const stateName = geoResult?.state || 'Unknown'

    if (user.onboarding_status === 'in_progress' && (step === 'collect_info' || step === 'update_location')) {
      const convState = user.conversation_state || {}

      user.latitude = lat
      user.longitude = lng
      user.location_city = cityName
      user.location_state = stateName

      if (step === 'collect_info') {
        const mergedInfo: ExtractedInfo = {
          name: user.full_name || null,
          age: user.age || null,
          gender: user.gender || null,
          city: cityName,
          state: stateName,
          lat: lat,
          lng: lng
        }
        const missing = getMissingFields(mergedInfo)

        if (missing.length > 0) {
          const newState = preserveShortcodeContext(convState, { location_resolved_via_pin: true })
          await supabase.from('applicants').update({
            latitude: lat, longitude: lng,
            location_city: cityName, location_state: stateName,
            conversation_state: newState,
            updated_at: new Date().toISOString()
          }).eq('id', user.id)

          const response = getText(lang, {
            ms: `Ok, Kak Ani dah dapat lokasi adik - ${cityName}, ${stateName}!\n\nTapi Kak Ani perlukan lagi: ${missing.map(m => m === 'name' ? 'nama' : m === 'age' ? 'umur' : m === 'gender' ? 'lelaki/perempuan' : m).join(', ')}`,
            en: `Got your location - ${cityName}, ${stateName}!\n\nBut I still need: ${missing.join(', ')}`,
            zh: `收到您的位置 - ${cityName}, ${stateName}！\n\n但我还需要：${missing.join(', ')}`
          })
          return { response, updatedUser: { ...user, conversation_state: newState } }
        }

        const shortcodeJobs = convState.shortcode_jobs
        if (shortcodeJobs && shortcodeJobs.length > 0) {
          console.log(`📍 Location pin + shortcode jobs → presenting shortcode jobs`)
          const newState = { matched_jobs: shortcodeJobs, current_job_index: 0 }
          await supabase.from('applicants').update({
            latitude: lat, longitude: lng,
            location_city: cityName, location_state: stateName,
            onboarding_status: 'matching', onboarding_step: 'viewing_jobs',
            conversation_state: newState,
            updated_at: new Date().toISOString()
          }).eq('id', user.id)

          const firstName = user.full_name?.split(' ')[0] || ''
          const response = getText(lang, {
            ms: `Ok ${firstName}! Lokasi dah direkod - ${cityName}, ${stateName}.\n\nBoleh pilih kerja dari senarai tadi. Balas nombor untuk mohon, atau 'lagi' untuk lebih banyak.`,
            en: `Ok ${firstName}! Location recorded - ${cityName}, ${stateName}.\n\nYou can select from the jobs listed earlier. Reply with a number to apply, or 'more' for more.`,
            zh: `好的${firstName}！位置已记录 - ${cityName}, ${stateName}。\n\n可以从之前的列表选择工作。回复数字申请，或「更多」查看更多。`
          })
          return { response, updatedUser: { ...user, onboarding_status: 'matching', onboarding_step: 'viewing_jobs', conversation_state: newState } }
        }

        const matchResult = await findAndPresentJobsConversational(user)
        const newState = buildPostSearchState(matchResult)
        await supabase.from('applicants').update({
          latitude: lat, longitude: lng,
          location_city: cityName, location_state: stateName,
          onboarding_status: 'matching', onboarding_step: 'viewing_jobs',
          conversation_state: newState,
          updated_at: new Date().toISOString()
        }).eq('id', user.id)

        const firstName = user.full_name?.split(' ')[0] || ''
        const jobCount = matchResult.jobs.length
        const response = jobCount > 0
          ? getText(lang, {
              ms: `Ok ${firstName}! Lokasi: ${cityName}, ${stateName}.\n\nNi ${jobCount} kerja dekat dengan adik:\n\n${matchResult.message}`,
              en: `Ok ${firstName}! Location: ${cityName}, ${stateName}.\n\nFound ${jobCount} jobs near you:\n\n${matchResult.message}`,
              zh: `好的${firstName}！位置：${cityName}, ${stateName}。\n\n找到${jobCount}个附近的工作：\n\n${matchResult.message}`
            })
          : matchResult.message
        return { response, updatedUser: { ...user, onboarding_status: 'matching', onboarding_step: 'viewing_jobs', conversation_state: newState } }
      }

      // update_location step
      const matchResult = await findAndPresentJobsConversational(user)
      const newState = buildPostSearchState(matchResult)
      await supabase.from('applicants').update({
        latitude: lat, longitude: lng,
        location_city: cityName, location_state: stateName,
        onboarding_status: 'matching', onboarding_step: 'viewing_jobs',
        conversation_state: newState,
        updated_at: new Date().toISOString()
      }).eq('id', user.id)

      const firstName = user.full_name?.split(' ')[0] || ''
      const jobCount = matchResult.jobs.length
      const response = jobCount > 0
        ? getText(lang, {
            ms: `Ok ${firstName}, lokasi dikemaskini ke ${cityName}, ${stateName}!\n\nNi ${jobCount} kerja dekat dengan adik:\n\n${matchResult.message}`,
            en: `Ok ${firstName}, location updated to ${cityName}, ${stateName}!\n\nFound ${jobCount} jobs near you:\n\n${matchResult.message}`,
            zh: `好的${firstName}，位置已更新为${cityName}, ${stateName}！\n\n找到${jobCount}个附近的工作：\n\n${matchResult.message}`
          })
        : matchResult.message
      return { response, updatedUser: { ...user, onboarding_status: 'matching', onboarding_step: 'viewing_jobs', conversation_state: newState } }
    }

    if (user.onboarding_status === 'matching' || user.onboarding_status === 'completed') {
      user.latitude = lat
      user.longitude = lng
      user.location_city = cityName
      user.location_state = stateName

      const matchResult = await findAndPresentJobsConversational(user)
      const newState = buildPostSearchState(matchResult)
      await supabase.from('applicants').update({
        latitude: lat, longitude: lng,
        location_city: cityName, location_state: stateName,
        onboarding_status: 'matching', onboarding_step: 'viewing_jobs',
        conversation_state: newState,
        updated_at: new Date().toISOString()
      }).eq('id', user.id)

      const firstName = user.full_name?.split(' ')[0] || ''
      const jobCount = matchResult.jobs.length
      const response = jobCount > 0
        ? getText(lang, {
            ms: `Ok ${firstName}! Kak Ani cari kerja dekat ${cityName}, ${stateName}.\n\nJumpa ${jobCount} kerja:\n\n${matchResult.message}`,
            en: `Ok ${firstName}! Searching near ${cityName}, ${stateName}.\n\nFound ${jobCount} jobs:\n\n${matchResult.message}`,
            zh: `好的${firstName}！在${cityName}, ${stateName}附近搜索。\n\n找到${jobCount}个工作：\n\n${matchResult.message}`
          })
        : matchResult.message
      return { response, updatedUser: { ...user, onboarding_status: 'matching', onboarding_step: 'viewing_jobs', conversation_state: newState } }
    }
  }

  // ===== HANDLE IMAGE MESSAGES =====
  if (messageType === 'image') {
    console.log(`🖼️ Image message received from ${user.phone_number}, status: ${user.onboarding_status}, step: ${step}`)
    const convState = user.conversation_state || {}

    if (user.onboarding_status === 'matching') {
      const newState = { ...convState, last_image_at: Date.now() }
      await supabase.from('applicants').update({
        conversation_state: newState,
        updated_at: new Date().toISOString()
      }).eq('id', user.id)

      const matchedJobs = convState.matched_jobs || []
      const currentIndex = convState.current_job_index || 0
      const pageStart = currentIndex + 1
      const pageEnd = Math.min(currentIndex + 3, matchedJobs.length)

      const response = getText(lang, {
        ms: `Terima kasih gambar tu! Tapi Kak Ani tak boleh tengok gambar.\n\nKalau adik berminat dengan kerja dalam senarai, balas nombor (${pageStart}-${pageEnd}) untuk mohon ye.`,
        en: `Thanks for the image! But I can't view images.\n\nIf you're interested in a job from the list, reply with a number (${pageStart}-${pageEnd}) to apply.`,
        zh: `谢谢图片！但我无法查看图片。\n\n如果您对列表中的工作感兴趣，请回复数字（${pageStart}-${pageEnd}）申请。`
      })
      return { response, updatedUser: { ...user, conversation_state: newState } }
    }

    if (user.onboarding_status === 'in_progress') {
      const newState = preserveShortcodeContext(convState, { ...convState, last_image_at: Date.now() })
      await supabase.from('applicants').update({
        conversation_state: newState,
        updated_at: new Date().toISOString()
      }).eq('id', user.id)

      const response = getText(lang, {
        ms: `Terima kasih gambar tu! Tapi Kak Ani perlukan maklumat dalam bentuk teks ye.\n\nBoleh taip maklumat adik?`,
        en: `Thanks for the image! But I need the information in text form.\n\nCould you type it out instead?`,
        zh: `谢谢图片！但我需要文字形式的信息。\n\n可以打字告诉我吗？`
      })
      return { response, updatedUser: { ...user, conversation_state: newState } }
    }

    const response = getText(lang, {
      ms: `Kak Ani tak boleh tengok gambar. Boleh bagitahu dalam bentuk teks?`,
      en: `I can't view images. Could you tell me in text instead?`,
      zh: `我无法查看图片。可以用文字告诉我吗？`
    })
    return { response, updatedUser: user }
  }

  // ===== CHECK FOR POST-IMAGE SELECTION INTENT =====
  const convStateCheck = user.conversation_state || {}
  if (convStateCheck.last_image_at && user.onboarding_status === 'matching' && isSelectionIntent(message)) {
    const timeSinceImage = Date.now() - convStateCheck.last_image_at
    if (timeSinceImage < 120000) {
      const matchedJobs = convStateCheck.matched_jobs || []
      const currentIndex = convStateCheck.current_job_index || 0
      const pageStart = currentIndex + 1
      const pageEnd = Math.min(currentIndex + 3, matchedJobs.length)

      const response = getText(lang, {
        ms: `Kak Ani faham adik berminat! Tapi Kak Ani tak boleh tengok gambar tu.\n\nBoleh bagitahu nombor kerja (${pageStart}-${pageEnd}) dari senarai yang adik nak mohon?`,
        en: `I understand you're interested! But I can't see the image.\n\nCould you tell me which job number (${pageStart}-${pageEnd}) from the list you'd like to apply for?`,
        zh: `我理解您感兴趣！但我无法查看图片。\n\n可以告诉我您想申请列表中的哪个工作编号（${pageStart}-${pageEnd}）吗？`
      })
      return { response, updatedUser: user }
    }
  }

  // Check for restart command anywhere (with language detection)
  const restartCheck = detectRestartCommand(message)
  if (restartCheck.isRestart) {
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
