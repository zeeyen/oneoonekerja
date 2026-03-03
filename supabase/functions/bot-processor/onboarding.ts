import { supabase, OPENAI_API_KEY } from './config.ts'
import { getTimeBasedGreeting, getText, normalizeLooseText, isLowSignalMessage } from './helpers.ts'
import type { User, ExtractedInfo, MatchedJob } from './types.ts'
import { buildSlot, normalizeStateAlias, normalizeLocationInput, isLikelyLocationLikeText, isLikelyValidName, isStructuredProfileMessage, constrainExtractionToMissingSlot, hasStrongCorrectionSignal, getProfileSlots, mergeSlotValue, applySlotsToUser } from './slots.ts'
import { addToRecentMessages } from './conversation.ts'
import type { RecentMessage } from './conversation.ts'
import { extractAllInfo, extractSpecificFields } from './extraction.ts'
import { getMissingFields, askOneMissingField, askForMissingInfo } from './missing-fields.ts'
import { generateKakAniResponse } from './gpt.ts'
import { updateUserInDB } from './db.ts'
import { lookupMalaysiaLocation } from './location.ts'
import { findAndPresentJobsConversational, buildPostSearchState, formatJobsMessage } from './jobs.ts'
// import { classifyIntent } from './intent.ts'  // DEPRECATED: replaced by understandMessage
import { understandMessage } from './nlu.ts'
import { normalizeInput } from './normalize.ts'
import { interceptCommand } from './commands.ts'

// Local copy of preserveShortcodeContext to avoid circular dependency with router.ts
function preserveShortcodeContext(existingState: Record<string, any>, newState: Record<string, any>): Record<string, any> {
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
// NEW USER - CONVERSATIONAL
// ============================================
export async function handleNewUserConversational(user: User): Promise<{ response: string, updatedUser: User }> {
  const { error } = await supabase
    .from('applicants')
    .update({
      onboarding_status: 'in_progress',
      onboarding_step: 'collect_info',
      preferred_language: 'ms',
      conversation_state: {},
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id)

  if (error) console.error('Error updating new user:', error)

  const greeting = getTimeBasedGreeting()

  const response = `${greeting.ms}!

Saya Kak Ani dari 101Kerja. Kak Ani terus tolong adik cari kerja ya.

Boleh bagitahu:
- Nama penuh
- Umur
- Lelaki/Perempuan
- Duduk mana (bandar, negeri)

Contoh: "Ahmad, 25, lelaki, Shah Alam Selangor"`

  return {
    response,
    updatedUser: { ...user, onboarding_status: 'in_progress', onboarding_step: 'collect_info', preferred_language: 'ms' }
  }
}

// ============================================
// ONBOARDING - SIMPLIFIED 2-STEP FLOW (No confirmation)
// ============================================
export async function handleOnboardingConversational(
  user: User,
  message: string,
  step: string
): Promise<{ response: string, updatedUser: User }> {

  // Pre-process: normalize copy-paste templates and structured separators
  message = normalizeInput(message)

  let updatedUser = { ...user }
  let nextStep = step === 'language' ? 'collect_info' : step
  let response = ''

  const lang = user.preferred_language || 'ms'

  const effectiveStep = step === 'language' ? 'collect_info' : step
  console.log(`📍 Onboarding step: ${step} (effective: ${effectiveStep}), message: "${message}"`)

  if (step === 'language') {
    // Backward compatibility with old rows that were left in 'language'.
    return await handleOnboardingConversational(
      { ...updatedUser, onboarding_step: 'collect_info', preferred_language: updatedUser.preferred_language || 'ms' },
      message,
      'collect_info'
    )
  }

  switch (effectiveStep) {
    // ========== STEP 2: COLLECT ALL INFO ==========
    case 'collect_info': {
      console.log('📝 collect_info: Starting extraction...')

      // Check conversation state FIRST to determine what to extract
      const convState = user.conversation_state || {}
      const isLocationClarification = convState.location_clarification_pending || convState.ambiguous_location_pending
      const recentMsgs: RecentMessage[] = convState.recent_messages || []

      // === COMMAND INTERCEPTION (before GPT — saves a call) ===
      if (!isLocationClarification && !convState.ambiguous_location_pending) {
        const currentInfo: ExtractedInfo = {
          name: updatedUser.full_name || null, age: updatedUser.age || null,
          gender: updatedUser.gender || null, city: updatedUser.location_city || null,
          state: updatedUser.location_state || null, lat: updatedUser.latitude || null, lng: updatedUser.longitude || null
        }
        const missingNow = getMissingFields(currentInfo)
        const hasShortcodeJobs = !!(convState.shortcode_jobs && convState.shortcode_jobs.length > 0)
        const cmd = interceptCommand(message, 'collect_info', missingNow, hasShortcodeJobs)

        if (cmd.intercepted) {
          console.log(`⚡ collect_info: Command intercepted: ${cmd.command}`)
          if (cmd.command === 'more' && hasShortcodeJobs) {
            // Redirect to provide missing info first, then they can browse jobs
            response = getText(lang, {
              ms: `Kak Ani perlukan maklumat adik dulu sebelum boleh teruskan ye.\n\n${askForMissingInfo(missingNow, lang, currentInfo)}`,
              en: `I need your info first before we continue.\n\n${askForMissingInfo(missingNow, lang, currentInfo)}`,
              zh: `我需要先获取您的信息才能继续。\n\n${askForMissingInfo(missingNow, lang, currentInfo)}`
            })
          } else if (cmd.command === 'number_select' && hasShortcodeJobs) {
            response = getText(lang, {
              ms: `Kak Ani perlukan maklumat adik dulu sebelum boleh mohon kerja ye.\n\n${askForMissingInfo(missingNow, lang, currentInfo)}`,
              en: `I need your info first before you can apply.\n\n${askForMissingInfo(missingNow, lang, currentInfo)}`,
              zh: `您需要先提供信息才能申请工作。\n\n${askForMissingInfo(missingNow, lang, currentInfo)}`
            })
          } else if (cmd.command === 'job_search') {
            response = getText(lang, {
              ms: `Kak Ani nak tolong carikan kerja! Tapi perlukan maklumat adik dulu:\n\n${askForMissingInfo(missingNow, lang, currentInfo)}`,
              en: `I'd love to help you find a job! But I need your info first:\n\n${askForMissingInfo(missingNow, lang, currentInfo)}`,
              zh: `我很乐意帮您找工作！但首先需要您的信息：\n\n${askForMissingInfo(missingNow, lang, currentInfo)}`
            })
          } else {
            // greeting_ack — just re-prompt for missing fields
            response = askForMissingInfo(missingNow, lang, currentInfo)
          }

          // Update state and break
          updatedUser.conversation_state = preserveShortcodeContext(convState, {
            ...convState,
            recent_messages: addToRecentMessages(convState, message, response)
          })
          break
        }
      }

      // NLU result — stored outside the block so extractableFields is accessible for extraction
      let nluExtractableFields: string[] = []

      // === NLU CLASSIFICATION (skip if in clarification mode) ===
      if (!isLocationClarification && !convState.ambiguous_location_pending) {
        const nluCurrentInfo: ExtractedInfo = {
          name: updatedUser.full_name || null, age: updatedUser.age || null,
          gender: updatedUser.gender || null, city: updatedUser.location_city || null,
          state: updatedUser.location_state || null, lat: updatedUser.latitude || null, lng: updatedUser.longitude || null
        }
        const nluMissing = getMissingFields(nluCurrentInfo)

        const nlu = await understandMessage(message, {
          currentStep: 'collect_info', missingFields: nluMissing, lang,
          hasName: !!updatedUser.full_name, hasAge: !!updatedUser.age,
          hasGender: !!updatedUser.gender, hasLocation: !!(updatedUser.location_city || updatedUser.location_state),
          userName: updatedUser.full_name?.split(' ')[0]
        }, recentMsgs)

        // Store extractable fields for use in extraction step
        nluExtractableFields = nlu.extractableFields || []

        // Persist detected language if different
        if (nlu.detectedLanguage && nlu.detectedLanguage !== lang) {
          updatedUser.preferred_language = nlu.detectedLanguage
        }

        if (nlu.messageType !== 'data_response' && nlu.confidence > 0.6 && !nlu.shouldExtract) {
          // Non-data message: use contextualResponse if available, else fall back to generateKakAniResponse
          let gptResponse: string
          if (nlu.contextualResponse) {
            gptResponse = nlu.contextualResponse
          } else {
            // Fallback: build context string and call generateKakAniResponse
            let contextForGPT = ''
            if (nlu.messageType === 'question') {
              contextForGPT = `User is asking a question during onboarding. They still need to provide: ${nluMissing.join(', ')}. Answer their question naturally and briefly, then gently remind them to provide the missing info. Keep it short (2-3 lines max).`
            } else if (nlu.messageType === 'confusion') {
              contextForGPT = `User seems confused during onboarding. They still need: ${nluMissing.join(', ')}. Be empathetic, simplify. Ask for ONE piece of info at a time. Keep it very short and warm.`
            } else if (nlu.messageType === 'job_preference') {
              contextForGPT = `User is expressing a job preference. Acknowledge warmly, then remind them you need: ${nluMissing.join(', ')} before finding matching jobs. Keep it short.`
            } else if (nlu.messageType === 'greeting') {
              contextForGPT = `User sent a greeting. Respond warmly and briefly, then re-ask for: ${nluMissing.join(', ')}. Keep it natural.`
            } else {
              contextForGPT = `User sent a non-data message. They still need: ${nluMissing.join(', ')}. Gently redirect them. Keep it short.`
            }
            gptResponse = await generateKakAniResponse(user, message, contextForGPT, recentMsgs)
          }

          // Track conversation history
          const updatedRecent = addToRecentMessages(convState, message, gptResponse)
          const newState = { ...convState, recent_messages: updatedRecent }
          await supabase.from('applicants').update({
            conversation_state: newState,
            updated_at: new Date().toISOString()
          }).eq('id', user.id)

          return { response: gptResponse, updatedUser: { ...user, conversation_state: newState } }
        }
      }

      // Use field-scoped extraction when NLU identified specific fields (saves cross-contamination)
      let extracted: ExtractedInfo
      if (nluExtractableFields.length > 0 && nluExtractableFields.length < 4) {
        console.log(`🎯 collect_info: Focused extraction for fields: [${nluExtractableFields}]`)
        extracted = await extractSpecificFields(message, lang, nluExtractableFields)
      } else {
        extracted = await extractAllInfo(message, lang)
      }

      // Context-first parsing: if exactly one slot is missing, focus extraction on that slot
      // (unless user sends a clearly structured full-profile message).
      const preMergeInfo: ExtractedInfo = {
        name: updatedUser.full_name || null,
        age: updatedUser.age || null,
        gender: updatedUser.gender || null,
        city: updatedUser.location_city || null,
        state: updatedUser.location_state || null,
        lat: updatedUser.latitude || null,
        lng: updatedUser.longitude || null
      }
      const missingBefore = getMissingFields(preMergeInfo)
      if (!isLocationClarification && missingBefore.length === 1) {
        extracted = constrainExtractionToMissingSlot(extracted, missingBefore[0], message)
      }
      if (extracted.state) extracted.state = normalizeStateAlias(extracted.state)
      console.log('📝 collect_info: Extracted (post-constraint):', JSON.stringify(extracted))

      // Slot-safe merge: stop destructive overwrites unless strong correction signal exists.
      const slotState = getProfileSlots(updatedUser, convState)
      if (!isLocationClarification) {
        mergeSlotValue('name', slotState, extracted.name, message)
        mergeSlotValue('age', slotState, extracted.age, message)
        mergeSlotValue('gender', slotState, extracted.gender, message)
      } else {
        console.log('📝 collect_info: In location clarification mode - preserving user info')
      }
      if (extracted.city || extracted.state || extracted.lat || extracted.lng) {
        mergeSlotValue('location', slotState, extracted.city || extracted.state, message)
      }

      updatedUser = applySlotsToUser(updatedUser, slotState, extracted)
      updatedUser.conversation_state = preserveShortcodeContext(convState, {
        ...(updatedUser.conversation_state || {}),
        profile_slots: slotState
      })

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
      if (missing.length === 0 && updatedUser.conversation_state) {
        const cleanedState = { ...updatedUser.conversation_state }
        delete cleanedState.missing_signature
        delete cleanedState.missing_retry_count
        updatedUser.conversation_state = cleanedState
      }

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
            updatedUser.conversation_state = preserveShortcodeContext(convState, {}) // Clear ambiguous state

            // Check for shortcode jobs first
            const shortcodeJobs = updatedUser.conversation_state?.shortcode_jobs
            if (shortcodeJobs && shortcodeJobs.length > 0) {
              console.log(`📝 collect_info: Using ${shortcodeJobs.length} pre-loaded shortcode jobs after ambiguous resolution`)
              updatedUser.onboarding_status = 'matching'
              updatedUser.conversation_state = { matched_jobs: shortcodeJobs, current_job_index: 0 }
              nextStep = 'viewing_jobs'

              const firstName = updatedUser.full_name?.split(' ')[0] || ''
              response = getText(lang, {
                ms: `Ok noted!\nNama: ${updatedUser.full_name}\nUmur: ${updatedUser.age}\nJantina: ${updatedUser.gender === 'male' ? 'Lelaki' : 'Perempuan'}\n\nBoleh pilih kerja dari senarai tadi. Balas nombor untuk mohon, atau 'lagi' untuk lebih banyak.`,
                en: `Ok noted!\nName: ${updatedUser.full_name}\nAge: ${updatedUser.age}\nGender: ${updatedUser.gender === 'male' ? 'Male' : 'Female'}\n\nYou can select from the jobs listed earlier. Reply with a number to apply, or 'more' for more.`,
                zh: `好的！\n姓名：${updatedUser.full_name}\n年龄：${updatedUser.age}\n性别：${updatedUser.gender === 'male' ? '男' : '女'}\n\n可以从之前的列表选择工作。回复数字申请，或「更多」查看更多。`
              })
            } else {
              // Normal flow - find jobs
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
            }
            break
          } else {
            // Geocoding failed - ask for more specific location but KEEP user's info
            console.log(`📝 collect_info: Geocoding failed for "${cityWithState}", asking for more details...`)

            const firstName = updatedUser.full_name?.split(' ')[0] || ''
            // Store user's confirmed info so it doesn't get overwritten
            updatedUser.conversation_state = preserveShortcodeContext(convState, {
              location_clarification_pending: true,
              confirmed_name: updatedUser.full_name,
              confirmed_age: updatedUser.age,
              confirmed_gender: updatedUser.gender,
              attempted_city: convState.ambiguous_city,
              attempted_state: chosenState
            })

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
          if (dbLookup && Number.isFinite(dbLookup.lat) && Number.isFinite(dbLookup.lng)) {
            console.log(`✅ Found "${cityToLookup}" in malaysia_locations: ${dbLookup.state}`)
            locationExtracted = {
              ...locationExtracted,
              city: locationExtracted.city || dbLookup.city || cityToLookup,
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
          updatedUser.conversation_state = preserveShortcodeContext(convState, {}) // Clear pending state

          // Check for shortcode jobs first
          const shortcodeJobsClarif = updatedUser.conversation_state?.shortcode_jobs
          if (shortcodeJobsClarif && shortcodeJobsClarif.length > 0) {
            console.log(`📝 collect_info: Using ${shortcodeJobsClarif.length} pre-loaded shortcode jobs after clarification`)
            updatedUser.onboarding_status = 'matching'
            updatedUser.conversation_state = { matched_jobs: shortcodeJobsClarif, current_job_index: 0 }
            nextStep = 'viewing_jobs'

            const firstName = updatedUser.full_name?.split(' ')[0] || ''
            response = getText(lang, {
              ms: `Ok ${firstName}, lokasi dah direkod!\n\nBoleh pilih kerja dari senarai tadi. Balas nombor untuk mohon, atau 'lagi' untuk lebih banyak.`,
              en: `Ok ${firstName}, location recorded!\n\nYou can select from the jobs listed earlier. Reply with a number to apply, or 'more' for more.`,
              zh: `好的${firstName}，位置已记录！\n\n可以从之前的列表选择工作。回复数字申请，或「更多」查看更多。`
            })
          } else {
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
          }
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
          const uniqueStates = [...new Set(extracted.possible_states.map((s) => normalizeStateAlias(s)))]
          const locationText = mergedInfo.city || mergedInfo.state

          // Auto-resolve if ambiguity collapses to one state candidate.
          if (uniqueStates.length === 1 && locationText) {
            const autoResolved = await lookupMalaysiaLocation(locationText, uniqueStates[0])
            if (autoResolved && Number.isFinite(autoResolved.lat) && Number.isFinite(autoResolved.lng)) {
              console.log(`📝 collect_info: Auto-resolved single-state location "${locationText}" -> ${uniqueStates[0]}`)
              updatedUser.location_city = autoResolved.city || locationText
              updatedUser.location_state = autoResolved.state
              updatedUser.latitude = autoResolved.lat
              updatedUser.longitude = autoResolved.lng
            }
          }

          if (updatedUser.latitude && updatedUser.longitude && updatedUser.location_state) {
            // Continue as resolved; no clarification prompt needed.
          } else {
            console.log('📝 collect_info: Ambiguous location detected, asking for clarification...')

            // Store ambiguous location info in conversation_state for when user replies with number
            updatedUser.location_city = undefined
            updatedUser.location_state = undefined
            updatedUser.latitude = undefined
            updatedUser.longitude = undefined
            updatedUser.conversation_state = preserveShortcodeContext(updatedUser.conversation_state || {}, {
              ambiguous_location_pending: true,
              ambiguous_city: locationText,
              ambiguous_states: uniqueStates
            })

            response = getText(lang, {
              ms: `"${locationText}" ni ada kat beberapa tempat.\n\nAdik duduk kat negeri mana?\n${uniqueStates.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nBalas nombor atau tulis nama penuh (contoh: "${locationText}, Selangor")`,
              en: `"${locationText}" exists in multiple areas.\n\nWhich state do you live in?\n${uniqueStates.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nReply with the number or full name (e.g., "${locationText}, Selangor")`,
              zh: `"${locationText}"在多个地区都有。\n\n你住在哪个州？\n${uniqueStates.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n回复数字或完整地名（如："${locationText}, Selangor"）`
            })
            // Stay in collect_info, don't change step
          }
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
          updatedUser.conversation_state = preserveShortcodeContext(updatedUser.conversation_state || {}, {
            location_clarification_pending: true,
            confirmed_name: updatedUser.full_name,
            confirmed_age: updatedUser.age,
            confirmed_gender: updatedUser.gender,
            attempted_location: locationText
          })

          response = getText(lang, {
            ms: `Hmm "${locationText}" tu kat mana ye? Kak Ani tak berapa cam.\n\nCuba tulis nama penuh tempat tu - contoh "Bandar Sri Damansara, Selangor" atau "Sungai Buloh".\n\nKalau kawasan perumahan, bagitahu nama bandar yang dekat.`,
            en: `Hmm not sure where "${locationText}" is exactly.\n\nCan you give me the full name? Like "Bandar Sri Damansara, Selangor" or "Sungai Buloh".\n\nIf it's a housing area, just tell me the nearest town.`,
            zh: `嗯，不太确定"${locationText}"在哪里。\n\n可以告诉我完整地名吗？比如"Bandar Sri Damansara, Selangor"或"Sungai Buloh"。\n\n如果是住宅区，告诉我最近的城镇就行。`
          })
          // Stay in collect_info, don't change step
        } else {
          // Got everything including coordinates - find jobs
          console.log('📝 collect_info: All fields complete, finding jobs...')

          const firstName = updatedUser.full_name?.split(' ')[0] || ''

          // Check if shortcode jobs are pre-loaded
          const shortcodeJobs = (updatedUser.conversation_state || {}).shortcode_jobs
          if (shortcodeJobs && shortcodeJobs.length > 0) {
            console.log(`📝 collect_info: Using ${shortcodeJobs.length} pre-loaded shortcode jobs`)

            updatedUser.onboarding_status = 'matching'
            updatedUser.conversation_state = {
              matched_jobs: shortcodeJobs,
              current_job_index: 0
            }
            nextStep = 'viewing_jobs'

            response = getText(lang, {
              ms: `Ok noted!\nNama: ${updatedUser.full_name}\nUmur: ${updatedUser.age}\nJantina: ${updatedUser.gender === 'male' ? 'Lelaki' : 'Perempuan'}\nLokasi: ${updatedUser.location_city || updatedUser.location_state}\n\nBoleh pilih kerja dari senarai tadi. Balas nombor untuk mohon, atau 'lagi' untuk lebih banyak.`,
              en: `Ok noted!\nName: ${updatedUser.full_name}\nAge: ${updatedUser.age}\nGender: ${updatedUser.gender === 'male' ? 'Male' : 'Female'}\nLocation: ${updatedUser.location_city || updatedUser.location_state}\n\nYou can now select from the jobs listed earlier. Reply with a number to apply, or 'more' for more options.`,
              zh: `好的！\n姓名：${updatedUser.full_name}\n年龄：${updatedUser.age}\n性别：${updatedUser.gender === 'male' ? '男' : '女'}\n地点：${updatedUser.location_city || updatedUser.location_state}\n\n现在可以从之前的列表中选择工作。回复数字申请，或「更多」查看更多。`
            })
          } else {
            // Normal flow - find and present jobs
            const matchResult = await findAndPresentJobsConversational(updatedUser)

            // Set status to 'matching' BEFORE database update
            updatedUser.onboarding_status = 'matching'
            updatedUser.conversation_state = buildPostSearchState(matchResult)
            nextStep = 'viewing_jobs'

            console.log('📝 collect_info: Setting status to matching, jobs:', matchResult.jobs.length)

            const jobCount = matchResult.jobs.length
            response = jobCount > 0
              ? getText(lang, {
                  ms: `Okay ${firstName}, jap ye Kak Ani carikan...\n\nNi ${jobCount} kerja dekat dengan adik:\n\n${matchResult.message}`,
                  en: `Alright ${firstName}, let me check...\n\nFound ${jobCount} jobs near you:\n\n${matchResult.message}`,
                  zh: `好的${firstName}，让我找找...\n\n找到${jobCount}个附近的工作：\n\n${matchResult.message}`
                })
              : matchResult.message
          }

          // Safety net: if ambiguity auto-resolved and no response was built yet, continue to job matching.
          if (!response && updatedUser.location_state && updatedUser.latitude && updatedUser.longitude) {
            const firstName = updatedUser.full_name?.split(' ')[0] || ''
            const shortcodeJobs = (updatedUser.conversation_state || {}).shortcode_jobs

            if (shortcodeJobs && shortcodeJobs.length > 0) {
              updatedUser.onboarding_status = 'matching'
              updatedUser.conversation_state = { matched_jobs: shortcodeJobs, current_job_index: 0 }
              nextStep = 'viewing_jobs'
              response = getText(lang, {
                ms: `Ok noted!\nNama: ${updatedUser.full_name}\nUmur: ${updatedUser.age}\nJantina: ${updatedUser.gender === 'male' ? 'Lelaki' : 'Perempuan'}\nLokasi: ${updatedUser.location_city || updatedUser.location_state}\n\nBoleh pilih kerja dari senarai tadi. Balas nombor untuk mohon, atau 'lagi' untuk lebih banyak.`,
                en: `Ok noted!\nName: ${updatedUser.full_name}\nAge: ${updatedUser.age}\nGender: ${updatedUser.gender === 'male' ? 'Male' : 'Female'}\nLocation: ${updatedUser.location_city || updatedUser.location_state}\n\nYou can now select from the jobs listed earlier. Reply with a number to apply, or 'more' for more options.`,
                zh: `好的！\n姓名：${updatedUser.full_name}\n年龄：${updatedUser.age}\n性别：${updatedUser.gender === 'male' ? '男' : '女'}\n地点：${updatedUser.location_city || updatedUser.location_state}\n\n现在可以从之前的列表中选择工作。回复数字申请，或「更多」查看更多。`
              })
            } else {
              const matchResult = await findAndPresentJobsConversational(updatedUser)
              updatedUser.onboarding_status = 'matching'
              updatedUser.conversation_state = buildPostSearchState(matchResult)
              nextStep = 'viewing_jobs'
              const jobCount = matchResult.jobs.length
              response = jobCount > 0
                ? getText(lang, {
                    ms: `Okay ${firstName}, jap ye Kak Ani carikan...\n\nNi ${jobCount} kerja dekat dengan adik:\n\n${matchResult.message}`,
                    en: `Alright ${firstName}, let me check...\n\nFound ${jobCount} jobs near you:\n\n${matchResult.message}`,
                    zh: `好的${firstName}，让我找找...\n\n找到${jobCount}个附近的工作：\n\n${matchResult.message}`
                  })
                : matchResult.message
            }
          }
        }
      } else {
        // Still missing some info - ask for it
        console.log('📝 collect_info: Asking for missing info...')
        const missingSignature = [...missing].sort().join('|')
        const prevSignature = convState.missing_signature || ''
        const retryCount = prevSignature === missingSignature
          ? (convState.missing_retry_count || 0) + 1
          : 1

        if (retryCount >= 5) {
          // ===== GRACEFUL DEGRADATION: escape infinite loop =====
          console.log(`⚠️ collect_info: Retry count ${retryCount}, gracefully degrading...`)
          const hasLocation = !!(updatedUser.location_city || updatedUser.location_state || updatedUser.latitude)
          const locationMissing = missing.includes('location')

          if (locationMissing && !hasLocation) {
            // Location is the critical missing field — offer WhatsApp location pin
            response = getText(lang, {
              ms: `Kak Ani perlukan lokasi adik untuk cari kerja berdekatan.\n\n📍 Cara mudah: tekan ikon 📎 (attachment) di WhatsApp → Lokasi → hantar lokasi semasa.\n\nAtau taip nama bandar, contoh: "Shah Alam"`,
              en: `I need your location to find nearby jobs.\n\n📍 Easy way: tap the 📎 (attachment) icon in WhatsApp → Location → send current location.\n\nOr type your city name, e.g. "Shah Alam"`,
              zh: `我需要您的位置来找附近的工作。\n\n📍 简单方法：点击WhatsApp中的📎（附件）图标 → 位置 → 发送当前位置。\n\n或输入城市名，例如："Shah Alam"`
            })
          } else {
            // Name/age/gender missing but we have location — proceed with placeholders
            console.log(`✅ collect_info: Proceeding with available data after ${retryCount} retries`)
            if (!updatedUser.full_name) updatedUser.full_name = 'PENGGUNA'
            if (!updatedUser.age) updatedUser.age = 0
            if (!updatedUser.gender) updatedUser.gender = 'any'

            updatedUser.onboarding_status = 'completed'
            nextStep = 'completed'

            const shortcodeJobs = (updatedUser.conversation_state || {}).shortcode_jobs
            if (shortcodeJobs && shortcodeJobs.length > 0) {
              updatedUser.onboarding_status = 'matching'
              updatedUser.conversation_state = { matched_jobs: shortcodeJobs, current_job_index: 0 }
              nextStep = 'viewing_jobs'
              response = getText(lang, {
                ms: `Takpe, kita teruskan je ya! 😊\n\nBoleh pilih kerja dari senarai tadi. Balas nombor untuk mohon, atau 'lagi' untuk lebih banyak.`,
                en: `No worries, let's continue! 😊\n\nYou can select from the jobs listed earlier. Reply with a number to apply, or 'more' for more options.`,
                zh: `没关系，我们继续吧！😊\n\n可以从之前的列表中选择工作。回复数字申请，或「更多」查看更多。`
              })
            } else {
              const matchResult = await findAndPresentJobsConversational(updatedUser)
              updatedUser.onboarding_status = 'matching'
              updatedUser.conversation_state = buildPostSearchState(matchResult)
              nextStep = 'viewing_jobs'
              const jobCount = matchResult.jobs.length
              response = getText(lang, {
                ms: `Takpe, kita teruskan je ya! 😊\n\nNi ${jobCount} kerja dekat dengan adik:\n\n${matchResult.message}`,
                en: `No worries, let's continue! 😊\n\nFound ${jobCount} jobs near you:\n\n${matchResult.message}`,
                zh: `没关系，我们继续吧！😊\n\n找到${jobCount}个附近的工作：\n\n${matchResult.message}`
              })
            }
          }
        } else if (retryCount >= 3) {
          const nextField = missing[0] || 'location'
          response = askOneMissingField(nextField, lang)
        } else {
          response = askForMissingInfo(missing, lang, mergedInfo)
        }

        updatedUser.conversation_state = preserveShortcodeContext(updatedUser.conversation_state || convState, {
          ...(updatedUser.conversation_state || convState),
          missing_signature: missingSignature,
          missing_retry_count: retryCount
        })
      }
      break
    }

    // ========== STEP: UPDATE LOCATION ONLY ==========
    case 'update_location':
      console.log('📝 update_location: Extracting location only...')
      const updateLocConvState = user.conversation_state || {}
      const updateRecentMsgs: RecentMessage[] = updateLocConvState.recent_messages || []

      // Context-first handling: user may ask a question mid-flow.
      const updateNlu = await understandMessage(message, {
        currentStep: 'update_location', missingFields: ['location'], lang,
        hasName: !!updatedUser.full_name, hasAge: !!updatedUser.age,
        hasGender: !!updatedUser.gender, hasLocation: false,
        userName: updatedUser.full_name?.split(' ')[0]
      }, updateRecentMsgs)

      if (updateNlu.detectedLanguage && updateNlu.detectedLanguage !== lang) {
        updatedUser.preferred_language = updateNlu.detectedLanguage
      }

      if (updateNlu.messageType === 'question' && updateNlu.confidence > 0.6) {
        let gptResponse: string
        if (updateNlu.contextualResponse) {
          gptResponse = updateNlu.contextualResponse
        } else {
          const ctx = `User is currently updating location but asked a question. Answer briefly (1-2 lines), then ask for their current city and state so you can continue finding nearby jobs.`
          gptResponse = await generateKakAniResponse(user, message, ctx, updateRecentMsgs)
        }
        const updatedRecent = addToRecentMessages(updateLocConvState, message, gptResponse)
        updatedUser.conversation_state = preserveShortcodeContext(updateLocConvState, { ...updateLocConvState, recent_messages: updatedRecent })
        response = gptResponse
        break
      }

      // Check if user is responding to ambiguous location prompt (reply with number)
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
          if (dbLookup && Number.isFinite(dbLookup.lat) && Number.isFinite(dbLookup.lng)) {
            console.log(`✅ Found "${cityToLookup}" in malaysia_locations: ${dbLookup.state}`)
            locationOnly = {
              ...locationOnly,
              city: locationOnly.city || dbLookup.city || cityToLookup,
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
          const locationText = locationExtracted.city || locationExtracted.state
          const uniqueStates = [...new Set(locationExtracted.possible_states.map((s) => normalizeStateAlias(s)))]

          if (locationText && uniqueStates.length === 1) {
            const autoResolved = await lookupMalaysiaLocation(locationText, uniqueStates[0])
            if (autoResolved && Number.isFinite(autoResolved.lat) && Number.isFinite(autoResolved.lng)) {
              updatedUser.location_city = autoResolved.city || locationText
              updatedUser.location_state = autoResolved.state
              updatedUser.latitude = autoResolved.lat
              updatedUser.longitude = autoResolved.lng
              locationExtracted.ambiguous = false
              locationExtracted.possible_states = undefined
              locationExtracted.lat = autoResolved.lat
              locationExtracted.lng = autoResolved.lng
              locationExtracted.state = autoResolved.state
              locationExtracted.city = autoResolved.city || locationText
              console.log(`📝 update_location: Auto-resolved single-state location "${locationText}" -> ${uniqueStates[0]}`)
            }
          }

          if (locationExtracted.ambiguous) {
            console.log('📝 update_location: Ambiguous location detected')
            updatedUser.location_city = undefined
            updatedUser.location_state = undefined
            updatedUser.latitude = undefined
            updatedUser.longitude = undefined
            updatedUser.conversation_state = {
              ...updatedUser.conversation_state,
              ambiguous_location_pending: true,
              ambiguous_city: locationText,
              ambiguous_states: uniqueStates
            }

            response = getText(lang, {
              ms: `"${locationText}" ni ada kat beberapa tempat.\n\nAdik duduk kat negeri mana?\n${uniqueStates.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nBalas nombor atau tulis nama penuh (contoh: "${locationText}, Selangor")`,
              en: `"${locationText}" exists in multiple areas.\n\nWhich state do you live in?\n${uniqueStates.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nReply with the number or full name (e.g., "${locationText}, Selangor")`,
              zh: `"${locationText}"在多个地区都有。\n\n你住在哪个州？\n${uniqueStates.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n回复数字或完整地名（如："${locationText}, Selangor"）`
            })
            // Stay in update_location step
          } else if (locationExtracted.lat && locationExtracted.lng) {
            // Ambiguity auto-resolved into a single state.
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
          }
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
