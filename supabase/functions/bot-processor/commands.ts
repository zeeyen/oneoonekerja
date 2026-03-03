// commands.ts — Pre-GPT command interception
// Catches well-known commands during collect_info to avoid wasting GPT calls
// and to prevent commands like "lagi" from being treated as profile data.

import { normalizeLooseText } from './helpers.ts'

export interface CommandResult {
  intercepted: boolean
  command: 'more' | 'number_select' | 'job_search' | 'greeting_ack' | null
  value?: number   // for number_select: the job number
}

const NOT_INTERCEPTED: CommandResult = { intercepted: false, command: null }

/**
 * Intercept well-known commands during collect_info step.
 * Returns `intercepted: true` when the message is a command (not profile data).
 * The handler should NOT feed intercepted messages to GPT extraction.
 */
export function interceptCommand(
  message: string,
  currentStep: string,
  missingFields: string[],
  hasShortcodeJobs: boolean
): CommandResult {
  // Only intercept during collect_info (other steps have their own command handling)
  if (currentStep !== 'collect_info') return NOT_INTERCEPTED

  const lower = normalizeLooseText(message)

  // --- "lagi" / "more" / "next" commands ---
  if (/^(lagi|more|next|seterusnya|lanjut|terus|继续|更多)$/i.test(lower)) {
    if (hasShortcodeJobs) {
      return { intercepted: true, command: 'more' }
    }
    // No shortcode jobs — "lagi" is meaningless, treat as noise to re-prompt
    return { intercepted: true, command: 'greeting_ack' }
  }

  // --- Pure number (1-99) when age is NOT missing → likely job selection ---
  const numMatch = lower.match(/^(\d{1,2})$/)
  if (numMatch) {
    const num = parseInt(numMatch[1], 10)
    // If age IS missing, a number 15-65 is probably the user's age — don't intercept
    if (missingFields.includes('age') && num >= 15 && num <= 65) {
      return NOT_INTERCEPTED
    }
    // Otherwise it's likely a job number selection
    if (num >= 1 && num <= 50 && hasShortcodeJobs) {
      return { intercepted: true, command: 'number_select', value: num }
    }
  }

  // --- Explicit job search phrases during data collection ---
  if (/^(cari\s*kerja|find\s*job|nak\s*kerja|want\s*job|找工作|i\s*want\s*(?:a\s*)?job)$/i.test(lower)) {
    return { intercepted: true, command: 'job_search' }
  }

  // --- Pure greetings / acknowledgements (no profile data) ---
  if (/^(hi|hello|hey|ok|okay|helo|hai|assalamualaikum|salam|waalaikumsalam|terima\s*kasih|thanks?|thank\s*you|baik|good|nice|boleh|alright|sure)$/i.test(lower)) {
    return { intercepted: true, command: 'greeting_ack' }
  }

  return NOT_INTERCEPTED
}
