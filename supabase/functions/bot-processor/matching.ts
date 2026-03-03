import { supabase, AGENCY_BASE_URL } from './config.ts'
import { getText } from './helpers.ts'
import type { User, MatchedJob } from './types.ts'
import { addToRecentMessages } from './conversation.ts'
import type { RecentMessage } from './conversation.ts'
// import { classifyIntent } from './intent.ts'  // DEPRECATED: replaced by understandMessage
import { understandMessage } from './nlu.ts'
import { extractAllInfo } from './extraction.ts'
import { detectJobSearchIntent, generateKakAniResponse } from './gpt.ts'
import { saveJobSelection } from './job-selections.ts'
import { findAndPresentJobsConversational, buildPostSearchState, formatJobsMessage, extractJobNumber, isMoreCommand } from './jobs.ts'
import { normalizeInput } from './normalize.ts'

export async function handleMatchingConversational(
  user: User,
  message: string
): Promise<{ response: string, updatedUser: User }> {
  // Pre-process: normalize copy-paste templates and structured separators
  message = normalizeInput(message)

  console.log(`🎯 handleMatchingConversational: message="${message}"`)

  const lang = user.preferred_language || 'ms'
  const convState = user.conversation_state || {}
  const matchedJobs: MatchedJob[] = convState.matched_jobs || []
  const currentIndex = convState.current_job_index || 0

  console.log(`🎯 Jobs in state: ${matchedJobs.length}, currentIndex: ${currentIndex}`)

  // ===== EXPAND SEARCH HANDLER =====
  if (convState.expand_search_pending) {
    const lower = message.toLowerCase().trim()
    const isYes = /^(ya|yes|ok|okay|1|是|boleh|nak|want|yep|yup|sure)$/i.test(lower)
    const isNo = /^(tidak|tak|no|2|不|不是|nope|nah|taknak|don't)$/i.test(lower)

    if (isYes) {
      const currentRadius = convState.current_radius || 10
      const nextRadius = currentRadius < 20 ? 20 : 50
      console.log(`🔍 Expanding search from ${currentRadius}km to ${nextRadius}km`)

      // Re-search at the new radius
      const expandResult = await findAndPresentJobsConversational(user, nextRadius)

      if (expandResult.jobs.length > 0) {
        // Found jobs at expanded radius
        const newState = {
          matched_jobs: expandResult.jobs,
          current_job_index: 0
        }
        await supabase.from('applicants').update({
          conversation_state: newState,
          updated_at: new Date().toISOString()
        }).eq('id', user.id)

        const firstName = user.full_name?.split(' ')[0] || ''
        const resp = getText(lang, {
          ms: `Jumpa ${expandResult.jobs.length} kerja dalam radius ${nextRadius}km!\n\n${expandResult.message}`,
          en: `Found ${expandResult.jobs.length} jobs within ${nextRadius}km!\n\n${expandResult.message}`,
          zh: `在${nextRadius}公里内找到${expandResult.jobs.length}个工作！\n\n${expandResult.message}`
        })
        return { response: resp, updatedUser: { ...user, conversation_state: newState } }
      } else if (expandResult.noJobsAtRadius && nextRadius < 50) {
        // Still no jobs, ask to expand further
        const newState = {
          expand_search_pending: true,
          current_radius: nextRadius,
          scored_jobs: expandResult.allScoredJobs || convState.scored_jobs || []
        }
        await supabase.from('applicants').update({
          conversation_state: newState,
          updated_at: new Date().toISOString()
        }).eq('id', user.id)
        return { response: expandResult.message, updatedUser: { ...user, conversation_state: newState } }
      } else {
        // Final tier or 50km with no jobs
        await supabase.from('applicants').update({
          conversation_state: {},
          onboarding_status: 'completed',
          updated_at: new Date().toISOString()
        }).eq('id', user.id)
        return { response: expandResult.message, updatedUser: { ...user, onboarding_status: 'completed', conversation_state: {} } }
      }
    } else if (isNo) {
      // User declined expansion
      await supabase.from('applicants').update({
        conversation_state: {},
        onboarding_status: 'completed',
        updated_at: new Date().toISOString()
      }).eq('id', user.id)

      const resp = getText(lang, {
        ms: `Ok takpe. Balas 'semula' bila nak cari kerja kat lokasi lain ye.`,
        en: `No problem. Reply 'restart' when you want to search in a different location.`,
        zh: `没关系。回复"重新开始"可以搜索其他位置。`
      })
      return { response: resp, updatedUser: { ...user, onboarding_status: 'completed', conversation_state: {} } }
    }
    // Unrecognized reply -- gently re-ask the yes/no question
    const currentRadius = convState.current_radius || 10
    const nextRadius = currentRadius < 20 ? 20 : 50
    const reaskResp = getText(lang, {
      ms: `Maaf, Kak Ani tak faham. Nak cari kerja dalam radius ${nextRadius}km?\n\nBalas 'ya' atau 'tidak'.`,
      en: `Sorry, I didn't understand. Search within ${nextRadius}km?\n\nReply 'yes' or 'no'.`,
      zh: `抱歉，我没听懂。要搜索${nextRadius}公里内的工作吗？\n\n回复"是"或"不是"。`
    })
    return { response: reaskResp, updatedUser: user }
  }

  // Handle edge case: no jobs in state (user may have arrived here incorrectly)
  if (matchedJobs.length === 0) {
    console.log('⚠️ No jobs in conversation state, checking for job search intent')

    // If user says "cari kerja" or similar, immediately trigger a new search
    if (await detectJobSearchIntent(message, lang)) {
      console.log('🔍 Job search intent detected in matching state with no jobs, triggering new search')
      // Use previous radius context to avoid repeating a failed radius
      const lastRadius = convState.current_radius || convState.last_search_radius || 10
      const searchRadius = lastRadius < 20 ? 20 : (lastRadius < 50 ? 50 : 10)
      console.log(`🔍 Using radius ${searchRadius}km based on previous radius ${lastRadius}km`)
      const searchResult = await findAndPresentJobsConversational(user, searchRadius)

      if (searchResult.jobs.length > 0) {
        // Update user state with new jobs
        const newState = {
          matched_jobs: searchResult.jobs,
          current_index: 0,
          total_jobs: searchResult.jobs.length
        }
        await supabase.from('applicants').update({
          onboarding_status: 'matching',
          conversation_state: newState,
          current_job_matches: searchResult.jobs.map(j => j.id),
          updated_at: new Date().toISOString()
        }).eq('id', user.id)
        return { response: searchResult.message, updatedUser: { ...user, onboarding_status: 'matching', conversation_state: newState } }
      }
      // No jobs found even with fresh search - reset to completed
      await supabase.from('applicants').update({
        onboarding_status: 'completed',
        conversation_state: {},
        updated_at: new Date().toISOString()
      }).eq('id', user.id)
      return { response: searchResult.message, updatedUser: { ...user, onboarding_status: 'completed', conversation_state: {} } }
    }

    // Not a search intent - reset to completed state to break the loop
    console.log('🔄 Resetting user from matching to completed state to break loop')
    await supabase.from('applicants').update({
      onboarding_status: 'completed',
      conversation_state: {},
      updated_at: new Date().toISOString()
    }).eq('id', user.id)

    const firstName = user.full_name?.split(' ')[0] || ''
    const response = getText(lang, {
      ms: `Hai ${firstName}! Tak ada kerja dalam senarai. Cakap "cari kerja" untuk mula cari.`,
      en: `Hi ${firstName}! No jobs in your list. Say "find job" to start searching.`,
      zh: `你好 ${firstName}！列表里没有工作。说"找工作"开始搜索。`
    })
    return { response, updatedUser: { ...user, onboarding_status: 'completed', conversation_state: {} } }
  }

  // Calculate valid range for current page
  const pageStart = currentIndex + 1
  const pageEnd = Math.min(currentIndex + 3, matchedJobs.length)

  // Try to extract job selection - ACCEPT ANY VALID JOB NUMBER (running numbers)
  const selection = extractJobNumber(message, matchedJobs.length)

  if (selection !== null) {
    // User selected a job by running number
    const jobIndex = selection - 1 // Convert 1-based to 0-based
    const selectedJob = matchedJobs[jobIndex]

    if (selectedJob) {
      // Simple apply URL (no JWT token needed)
      const applyUrl = selectedJob.url || `${AGENCY_BASE_URL}/${selectedJob.id}`

      const location = [selectedJob.location_city, selectedJob.location_state].filter(Boolean).join(', ')
      const salary = selectedJob.salary_range || getText(lang, { ms: 'Gaji negotiate', en: 'Salary negotiable', zh: '薪资面议' })

      // Save job selection to database
      await saveJobSelection(user.id, selectedJob, applyUrl)

      // Update user status — preserve last selected job for follow-up questions
      const lastSelectedJob = {
        title: selectedJob.title,
        company: selectedJob.company,
        location_city: selectedJob.location_city,
        location_state: selectedJob.location_state,
        salary_range: selectedJob.salary_range,
        job_type: selectedJob.job_type || null,
        url: applyUrl,
        external_job_id: selectedJob.external_job_id || null
      }
      const completedState = { last_selected_job: lastSelectedJob }
      await supabase.from('applicants').update({
        onboarding_status: 'completed',
        conversation_state: completedState,
        updated_at: new Date().toISOString()
      }).eq('id', user.id)

      const displayTitle = selectedJob.external_job_id ? `${selectedJob.title} (${selectedJob.external_job_id})` : selectedJob.title

      const response = getText(lang, {
ms: `Best! Adik pilih:\n\n*${displayTitle}* di *${selectedJob.company}*\n📍 ${location}\n💰 ${salary}\n\n👉 Klik untuk daftar: ${applyUrl}\n\n⚠️ *PENTING:* Pilih kat sini baru langkah pertama! Adik WAJIB klik link dan daftar kat website untuk lengkapkan permohonan.\n\nBalas 'semula' nak cari kerja lain.`,
        en: `Great choice!\n\n*${displayTitle}* at *${selectedJob.company}*\n📍 ${location}\n💰 ${salary}\n\n👉 Click to register: ${applyUrl}\n\n⚠️ *IMPORTANT:* Selecting here is just the first step! You MUST click the link and register on the website to complete your application.\n\nReply 'restart' to find more jobs.`,
        zh: `好选择！\n\n*${selectedJob.company}* 的 *${displayTitle}*\n📍 ${location}\n💰 ${salary}\n\n👉 点击注册：${applyUrl}\n\n⚠️ *重要：* 在这里选择只是第一步！您必须点击链接并在网站上注册才能完成申请。\n\n回复「重新开始」找更多工作。`
      })

      return {
        response,
        updatedUser: { ...user, onboarding_status: 'completed', conversation_state: completedState }
      }
    }
  }

  // Check for "more" / "lagi" command
  const isMore = isMoreCommand(message)
  console.log(`🎯 isMoreCommand("${message}"): ${isMore}`)

  if (isMore) {
    let newIndex = currentIndex + 3

    // Check if we've reached the end of the list
    if (newIndex >= matchedJobs.length) {
      // Show end-of-list message instead of cycling
      const endMessage = getText(lang, {
        ms: `Dah habis senarai kerja! Adik dah tengok semua ${matchedJobs.length} kerja yang ada.\n\nNak buat apa?\n• Balas nombor (1-${matchedJobs.length}) untuk mohon mana-mana kerja\n• Balas 'semula' untuk cari semula dari awal`,
        en: `That's all the jobs! You've seen all ${matchedJobs.length} available jobs.\n\nWhat would you like to do?\n• Reply with a number (1-${matchedJobs.length}) to apply for any job\n• Reply 'restart' to search again from the beginning`,
        zh: `已经看完所有工作了！您已浏览了全部${matchedJobs.length}个职位。\n\n您想要：\n• 回复数字（1-${matchedJobs.length}）申请任何工作\n• 回复「重新开始」从头搜索`
      })
      return {
        response: endMessage,
        updatedUser: user
      }
    }

    const newConvState = { ...convState, current_job_index: newIndex }
    await supabase.from('applicants').update({
      conversation_state: newConvState,
      updated_at: new Date().toISOString()
    }).eq('id', user.id)

    const jobsMessage = formatJobsMessage(matchedJobs, newIndex, lang)
    return {
      response: jobsMessage,
      updatedUser: { ...user, conversation_state: newConvState }
    }
  }

  // Context-aware relocation search while in matching state.
  // Example: "ada kerja dekat KL?" / "find jobs in Johor".
  const relocationSearchIntent =
    /(\bcari\b|\bfind\b|\bjob\b|\bkerja\b)/i.test(message) &&
    /(\bdekat\b|\bkat\b|\bnear\b|\bin\b|\blokasi\b|\blocation\b|\bjauh\b|\bfar\b|\barea\b)/i.test(message)
  if (relocationSearchIntent) {
    const extractedRelocation = await extractAllInfo(message, lang)
    if ((extractedRelocation.city || extractedRelocation.state) && extractedRelocation.lat && extractedRelocation.lng) {
      user.location_city = extractedRelocation.city || user.location_city
      user.location_state = extractedRelocation.state || user.location_state
      user.latitude = extractedRelocation.lat
      user.longitude = extractedRelocation.lng

      const relocated = await findAndPresentJobsConversational(user)
      const newState = buildPostSearchState(relocated)
      await supabase.from('applicants').update({
        onboarding_status: 'matching',
        onboarding_step: 'viewing_jobs',
        location_city: user.location_city,
        location_state: user.location_state,
        latitude: user.latitude,
        longitude: user.longitude,
        conversation_state: newState,
        updated_at: new Date().toISOString()
      }).eq('id', user.id)

      const firstName = user.full_name?.split(' ')[0] || ''
      const jobCount = relocated.jobs.length
      const relocationResponse = jobCount > 0
        ? getText(lang, {
            ms: `Ok ${firstName}, Kak Ani cari dekat ${user.location_city || user.location_state}.\n\nJumpa ${jobCount} kerja:\n\n${relocated.message}`,
            en: `Ok ${firstName}, searching near ${user.location_city || user.location_state}.\n\nFound ${jobCount} jobs:\n\n${relocated.message}`,
            zh: `好的${firstName}，正在${user.location_city || user.location_state}附近搜索。\n\n找到${jobCount}个工作：\n\n${relocated.message}`
          })
        : relocated.message

      return { response: relocationResponse, updatedUser: { ...user, onboarding_status: 'matching', onboarding_step: 'viewing_jobs', conversation_state: newState } }
    }
  }

  // === NLU CLASSIFICATION before fallback ===
  const recentMsgsMatch: RecentMessage[] = convState.recent_messages || []
  const matchNlu = await understandMessage(message, {
    currentStep: 'matching', missingFields: [], lang,
    hasName: !!user.full_name, hasAge: !!user.age,
    hasGender: !!user.gender, hasLocation: !!(user.location_city || user.location_state),
    userName: user.full_name?.split(' ')[0]
  }, recentMsgsMatch)

  // Persist detected language if different
  if (matchNlu.detectedLanguage && matchNlu.detectedLanguage !== lang) {
    user.preferred_language = matchNlu.detectedLanguage
  }

  if (matchNlu.messageType === 'question') {
    // User asking about a job - provide context from matched jobs
    let gptResp: string
    if (matchNlu.contextualResponse) {
      gptResp = matchNlu.contextualResponse
    } else {
      const jobsSummary = matchedJobs.slice(currentIndex, currentIndex + 3)
        .map((j, i) => `${currentIndex + i + 1}. ${j.title} at ${j.company} (${j.location_city}, Type: ${j.job_type || 'Not specified'})`).join('\n')
      const ctx = `User is viewing jobs and asking a question. Current jobs shown:\n${jobsSummary}\n\nAnswer their question using the job info above. Then remind them to reply with a number (${pageStart}-${pageEnd}) to apply or 'lagi'/'more' for more options. Keep it short.`
      gptResp = await generateKakAniResponse(user, message, ctx, recentMsgsMatch)
    }

    const updatedRecent = addToRecentMessages(convState, message, gptResp)
    const newState = { ...convState, recent_messages: updatedRecent }
    await supabase.from('applicants').update({
      conversation_state: newState,
      updated_at: new Date().toISOString()
    }).eq('id', user.id)

    return { response: gptResp, updatedUser: { ...user, conversation_state: newState } }
  }

  if (matchNlu.messageType === 'job_preference') {
    let gptResp: string
    if (matchNlu.contextualResponse) {
      gptResp = matchNlu.contextualResponse
    } else {
      const ctx = `User is expressing a job preference while viewing job listings. Acknowledge their preference. Then remind them to pick a job number (${pageStart}-${pageEnd}) from the current list, say 'lagi'/'more' for more, or 'semula'/'restart' to search with different criteria. Keep it short.`
      gptResp = await generateKakAniResponse(user, message, ctx, recentMsgsMatch)
    }

    const updatedRecent = addToRecentMessages(convState, message, gptResp)
    const newState = { ...convState, recent_messages: updatedRecent }
    await supabase.from('applicants').update({
      conversation_state: newState,
      updated_at: new Date().toISOString()
    }).eq('id', user.id)

    return { response: gptResp, updatedUser: { ...user, conversation_state: newState } }
  }

  // Default fallback - show help
  const response = getText(lang, {
    ms: `Balas nombor (${pageStart}-${pageEnd}) untuk memohon, atau 'lagi' untuk pilihan lain.`,
    en: `Reply with a number (${pageStart}-${pageEnd}) to apply, or 'more' for more options.`,
    zh: `回复数字（${pageStart}-${pageEnd}）申请，或「更多」查看更多。`
  })

  return { response, updatedUser: user }
}
