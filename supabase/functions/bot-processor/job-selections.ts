// job-selections.ts — Job selection tracking and formatting

import { supabase } from './config.ts'
import { getText } from './helpers.ts'
import type { JobSelection, MatchedJob } from './types.ts'

export async function getUserJobSelections(userId: string, limit: number = 10): Promise<JobSelection[]> {
  const { data, error } = await supabase
    .from('job_selections')
    .select('*')
    .eq('user_id', userId)
    .order('selected_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching job selections:', error)
    return []
  }

  return data || []
}

export async function saveJobSelection(
  userId: string,
  job: MatchedJob,
  applyUrl: string
): Promise<void> {
  const { error } = await supabase
    .from('job_selections')
    .upsert({
      user_id: userId,
      job_id: job.id,
      job_title: job.title,
      company: job.company,
      location_city: job.location_city,
      location_state: job.location_state,
      apply_url: applyUrl,
      selected_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,job_id'
    })

  if (error) {
    console.error('Error saving job selection:', error)
  } else {
    console.log(`📋 Saved job selection: ${job.title} for user ${userId}`)
  }
}

export function formatTimeAgo(dateString: string, lang: string): string {
  const now = new Date()
  const then = new Date(dateString)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) {
    return getText(lang, {
      ms: `${diffMins} minit lepas`,
      en: `${diffMins} min ago`,
      zh: `${diffMins}分钟前`
    })
  } else if (diffHours < 24) {
    return getText(lang, {
      ms: `${diffHours} jam lepas`,
      en: `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`,
      zh: `${diffHours}小时前`
    })
  } else {
    return getText(lang, {
      ms: `${diffDays} hari lepas`,
      en: `${diffDays} day${diffDays > 1 ? 's' : ''} ago`,
      zh: `${diffDays}天前`
    })
  }
}

export function formatJobSelectionsMessage(selections: JobSelection[], lang: string): string {
  if (selections.length === 0) return ''

  const header = getText(lang, {
    ms: `📋 *Kerja Yang Adik Dah Pilih:*\n━━━━━━━━━━━━━━━━━━━━`,
    en: `📋 *Jobs You've Selected:*\n━━━━━━━━━━━━━━━━━━━━`,
    zh: `📋 *您已选择的工作：*\n━━━━━━━━━━━━━━━━━━━━`
  })

  const jobLines = selections.map((sel, idx) => {
    const location = [sel.location_city, sel.location_state].filter(Boolean).join(', ') || 'Flexible'
    const timeAgo = formatTimeAgo(sel.selected_at, lang)
    return `${idx + 1}. ${sel.job_title}${sel.company ? ` - ${sel.company}` : ''}\n   📍 ${location} | ⏰ ${timeAgo}\n   👉 ${sel.apply_url}`
  }).join('\n\n')

  const disclaimer = getText(lang, {
    ms: `\n━━━━━━━━━━━━━━━━━━━━\n⚠️ *PENTING:* Pilih kat chatbot ni baru langkah pertama. Adik WAJIB klik link dan daftar kat website untuk lengkapkan permohonan!`,
    en: `\n━━━━━━━━━━━━━━━━━━━━\n⚠️ *IMPORTANT:* Selecting here is just the first step. You MUST click the link and register on the website to complete your application!`,
    zh: `\n━━━━━━━━━━━━━━━━━━━━\n⚠️ *重要：* 在这里选择只是第一步。您必须点击链接并在网站上注册才能完成申请！`
  })

  return `${header}\n${jobLines}${disclaimer}`
}
