// completed.ts — Handler for users who have completed onboarding

import { supabase } from './config.ts'
import { getText } from './helpers.ts'
import { User } from './types.ts'
import { RecentMessage, addToRecentMessages } from './conversation.ts'
// import { classifyIntent } from './intent.ts'  // DEPRECATED: replaced by understandMessage
import { understandMessage } from './nlu.ts'
import { extractAllInfo } from './extraction.ts'
import { detectJobSearchIntent, generateKakAniResponse } from './gpt.ts'
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

  // Check explicit keyword-based job search intent first
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

  // === NLU CLASSIFICATION for implicit job search or questions ===
  const nlu = await understandMessage(message, {
    currentStep: 'completed', missingFields: [], lang,
    hasName: !!user.full_name, hasAge: !!user.age,
    hasGender: !!user.gender, hasLocation: !!(user.location_city || user.location_state),
    userName: firstName
  }, recentMsgs)

  // Persist detected language if different
  if (nlu.detectedLanguage && nlu.detectedLanguage !== lang) {
    user.preferred_language = nlu.detectedLanguage
  }

  if (nlu.messageType === 'job_preference') {
    // User expressing interest in a type of work → treat as implicit job search
    // Try to extract location if mentioned
    const extracted = await extractAllInfo(message, lang)
    if (extracted.city && extracted.lat && extracted.lng) {
      // Update location and search
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

  if (nlu.messageType === 'question') {
    // Use contextualResponse from NLU if available, saving a GPT call
    let gptResp: string
    if (nlu.contextualResponse) {
      gptResp = nlu.contextualResponse
    } else {
      // Build context — include last selected job if available
      let ctx = `User has completed onboarding and is asking a question. Their profile: name=${user.full_name}, location=${user.location_city}, ${user.location_state}.`
      const lastJob = convState.last_selected_job
      if (lastJob) {
        ctx += `\n\nThe user just selected this job:\n- Title: ${lastJob.title}\n- Company: ${lastJob.company}\n- Location: ${lastJob.location_city || ''}, ${lastJob.location_state || ''}\n- Salary: ${lastJob.salary_range || 'Not specified'}\n- Type: ${lastJob.job_type || 'Not specified'}\n- Apply URL: ${lastJob.url || 'N/A'}\n\nIf the user is asking about this job (e.g., full time/part time, salary, location), answer using the info above. If the job_type is null or 'Not specified', say you don't have that info and suggest they check the apply link.`
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

  const response = getText(lang, {
    ms: `Hai ${firstName}!\n\nNak cari kerja baru? Cakap je "cari kerja" dan Kak Ani tolong carikan.`,
    en: `Hi ${firstName}!\n\nWant to find a new job? Just say "find job" and I'll help you search.`,
    zh: `你好 ${firstName}！\n\n想找新工作吗？说"找工作"，我帮你找。`
  })

  return { response, updatedUser: user }
}
