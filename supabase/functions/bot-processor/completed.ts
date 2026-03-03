// completed.ts — Handler for users who have completed onboarding
// Now fully LLM-driven: NO pre-NLU pattern matching gates.

import { supabase } from './config.ts'
import { getText } from './helpers.ts'
import { User } from './types.ts'
import { RecentMessage, addToRecentMessages } from './conversation.ts'
import { understandMessage } from './nlu.ts'
import { extractAllInfo } from './extraction.ts'
import { generateKakAniResponse } from './gpt.ts'
import { findAndPresentJobsConversational, buildPostSearchState } from './jobs.ts'
import { updateUserInDB } from './db.ts'
import { normalizeInput } from './normalize.ts'

export async function handleCompletedUserConversational(
  user: User,
  message: string
): Promise<{ response: string, updatedUser: User }> {
  // Pre-process: normalize copy-paste templates and structured separators
  message = normalizeInput(message)

  const lang = user.preferred_language || 'ms'
  const firstName = user.full_name?.split(' ')[0] || ''
  const convState = user.conversation_state || {}
  const recentMsgs: RecentMessage[] = convState.recent_messages || []
  const lastSelectedJob = convState.last_selected_job || null

  // === SINGLE NLU CALL — handles ALL intents ===
  const nlu = await understandMessage(message, {
    currentStep: 'completed', missingFields: [], lang,
    hasName: !!user.full_name, hasAge: !!user.age,
    hasGender: !!user.gender, hasLocation: !!(user.location_city || user.location_state),
    userName: firstName,
    lastSelectedJob
  }, recentMsgs)

  // Persist detected language if different
  if (nlu.detectedLanguage && nlu.detectedLanguage !== lang) {
    user.preferred_language = nlu.detectedLanguage
  }

  // === LANGUAGE SWITCH ===
  if (nlu.messageType === 'language_switch' && nlu.switchToLanguage) {
    user.preferred_language = nlu.switchToLanguage
    const newLang = nlu.switchToLanguage
    await supabase.from('applicants').update({
      preferred_language: newLang,
      updated_at: new Date().toISOString()
    }).eq('id', user.id)

    const resp = getText(newLang, {
      ms: `Ok ${firstName}, Kak Ani akan cakap BM ye! 😊\n\nNak cari kerja? Cakap je.`,
      en: `Ok ${firstName}, I'll speak English now! 😊\n\nWant to find a job? Just let me know.`,
      zh: `好的${firstName}，我现在说中文！😊\n\n想找工作吗？告诉我就行。`
    })
    return { response: resp, updatedUser: { ...user, preferred_language: newLang } }
  }

  // === EXPLICIT JOB SEARCH (e.g. "cari kerja", "find job") ===
  if (nlu.messageType === 'job_search') {
    return await performJobSearch(user, lang, firstName)
  }

  // === JOB SEARCH WITH LOCATION (e.g. "ada kerja kat Muar?") ===
  if (nlu.messageType === 'job_search_location') {
    const locationQuery = nlu.detectedLocation || message
    const extracted = await extractAllInfo(locationQuery, lang)

    if (extracted.city || extracted.state) {
      if (extracted.lat && extracted.lng) {
        user.location_city = extracted.city || user.location_city
        user.location_state = extracted.state || user.location_state
        user.latitude = extracted.lat
        user.longitude = extracted.lng
      }
    }

    const result = await findAndPresentJobsConversational(user)
    const updatedUser = {
      ...user,
      onboarding_status: 'matching',
      conversation_state: buildPostSearchState(result)
    }
    await updateUserInDB(user.id, updatedUser, 'viewing_jobs')

    const jobCount = result.jobs.length
    const locText = extracted.city || extracted.state || locationQuery
    return {
      response: jobCount > 0
        ? getText(lang, {
            ms: `Ok ${firstName}, Kak Ani cari dekat ${locText}...\n\nJumpa ${jobCount} kerja:\n\n${result.message}`,
            en: `Ok ${firstName}, searching near ${locText}...\n\nFound ${jobCount} jobs:\n\n${result.message}`,
            zh: `好的${firstName}，正在${locText}附近搜索...\n\n找到${jobCount}个工作：\n\n${result.message}`
          })
        : result.message,
      updatedUser
    }
  }

  // === JOB PREFERENCE (e.g. "nak kerja warehouse") ===
  if (nlu.messageType === 'job_preference') {
    // Treat as implicit job search
    const extracted = await extractAllInfo(message, lang)
    if (extracted.city && extracted.lat && extracted.lng) {
      user.location_city = extracted.city
      user.location_state = extracted.state || user.location_state
      user.latitude = extracted.lat
      user.longitude = extracted.lng
    }

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
            ms: `Ok, Kak Ani faham! Jumpa ${jobCount} kerja yang mungkin sesuai:\n\n${result.message}`,
            en: `Got it! Found ${jobCount} jobs that might match:\n\n${result.message}`,
            zh: `好的！找到${jobCount}个可能合适的工作：\n\n${result.message}`
          })
        : result.message,
      updatedUser
    }
  }

  // === QUESTION ABOUT SPECIFIC JOB (e.g. "part time ke full time?") ===
  if (nlu.messageType === 'question_about_job') {
    let gptResp: string
    if (nlu.contextualResponse) {
      gptResp = nlu.contextualResponse
    } else {
      let ctx = `User has completed onboarding and is asking about a specific job. Their profile: name=${user.full_name}, location=${user.location_city}, ${user.location_state}.`
      if (lastSelectedJob) {
        ctx += `\n\nThe user just selected this job:\n- Title: ${lastSelectedJob.title}\n- Company: ${lastSelectedJob.company}\n- Location: ${lastSelectedJob.location_city || ''}, ${lastSelectedJob.location_state || ''}\n- Salary: ${lastSelectedJob.salary_range || 'Not specified'}\n- Type: ${lastSelectedJob.job_type || 'Not specified'}\n- Apply URL: ${lastSelectedJob.url || 'N/A'}\n\nAnswer using the info above. If the info is not available (e.g. job_type is null), say honestly that you don't have that info and suggest they check the apply link.`
      }
      ctx += ` Answer in ${lang === 'zh' ? 'Chinese' : lang === 'en' ? 'English' : 'casual Malay'}. Keep it short.`
      gptResp = await generateKakAniResponse(user, message, ctx, recentMsgs)
    }

    const updatedRecent = addToRecentMessages(convState, message, gptResp)
    await supabase.from('applicants').update({
      conversation_state: { ...convState, recent_messages: updatedRecent },
      updated_at: new Date().toISOString()
    }).eq('id', user.id)

    return { response: gptResp, updatedUser: { ...user, conversation_state: { ...convState, recent_messages: updatedRecent } } }
  }

  // === GENERAL QUESTION (e.g. "macam mana nak apply?") ===
  if (nlu.messageType === 'question') {
    let gptResp: string
    if (nlu.contextualResponse) {
      gptResp = nlu.contextualResponse
    } else {
      let ctx = `User has completed onboarding and is asking a general question. Their profile: name=${user.full_name}, location=${user.location_city}, ${user.location_state}.`
      if (lastSelectedJob) {
        ctx += `\n\nLast selected job: ${lastSelectedJob.title} at ${lastSelectedJob.company}.`
      }
      ctx += ` Answer their question helpfully and briefly. Keep it short.`
      gptResp = await generateKakAniResponse(user, message, ctx, recentMsgs)
    }

    const updatedRecent = addToRecentMessages(convState, message, gptResp)
    await supabase.from('applicants').update({
      conversation_state: { ...convState, recent_messages: updatedRecent },
      updated_at: new Date().toISOString()
    }).eq('id', user.id)

    return { response: gptResp, updatedUser: { ...user, conversation_state: { ...convState, recent_messages: updatedRecent } } }
  }

  // === CONFUSION ===
  if (nlu.messageType === 'confusion') {
    const resp = nlu.contextualResponse || getText(lang, {
      ms: `Takpe ${firstName}, Kak Ani kat sini nak tolong. Nak cari kerja? Cakap je lokasi yang adik nak, contoh "ada kerja kat Shah Alam?"`,
      en: `No worries ${firstName}, I'm here to help. Want to find a job? Just tell me the location, e.g. "any jobs in Shah Alam?"`,
      zh: `没关系${firstName}，我在这里帮你。想找工作吗？告诉我地点就行，比如"Shah Alam有工作吗？"`
    })

    const updatedRecent = addToRecentMessages(convState, message, resp)
    await supabase.from('applicants').update({
      conversation_state: { ...convState, recent_messages: updatedRecent },
      updated_at: new Date().toISOString()
    }).eq('id', user.id)

    return { response: resp, updatedUser: { ...user, conversation_state: { ...convState, recent_messages: updatedRecent } } }
  }

  // === FALLBACK — GPT-powered contextual response instead of rigid redirect ===
  {
    let gptResp: string
    if (nlu.contextualResponse) {
      gptResp = nlu.contextualResponse
    } else {
      let ctx = `User has completed onboarding. Their profile: name=${user.full_name}, location=${user.location_city}, ${user.location_state}.`
      if (lastSelectedJob) {
        ctx += `\n\nLast selected job: "${lastSelectedJob.title}" at "${lastSelectedJob.company}", salary: ${lastSelectedJob.salary_range || 'N/A'}, type: ${lastSelectedJob.job_type || 'N/A'}, apply URL: ${lastSelectedJob.url || 'N/A'}.`
        ctx += `\nIf the user seems to be asking about this job, answer using these details.`
      }
      ctx += `\n\nRespond naturally to whatever the user said. If they seem to want to find jobs, encourage them. If they're asking a question, answer it. Keep it short (1-3 lines). Language: ${lang === 'zh' ? 'Chinese' : lang === 'en' ? 'English' : 'casual Malay'}.`
      gptResp = await generateKakAniResponse(user, message, ctx, recentMsgs)
    }

    const updatedRecent = addToRecentMessages(convState, message, gptResp)
    await supabase.from('applicants').update({
      conversation_state: { ...convState, recent_messages: updatedRecent },
      updated_at: new Date().toISOString()
    }).eq('id', user.id)

    return { response: gptResp, updatedUser: { ...user, conversation_state: { ...convState, recent_messages: updatedRecent } } }
  }
}

// Helper: perform a generic job search at user's current location
async function performJobSearch(
  user: User, lang: string, firstName: string
): Promise<{ response: string, updatedUser: User }> {
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
