// gpt.ts — GPT response generation and extraction helpers

import { OPENAI_API_KEY, KAK_ANI_SYSTEM_PROMPT } from './config.ts'
import type { GPTMessage, User } from './types.ts'
import type { RecentMessage } from './conversation.ts'

export async function generateKakAniResponse(
  user: User,
  userMessage: string,
  contextInstruction: string,
  recentMessages?: RecentMessage[]
): Promise<string> {

  const messages: GPTMessage[] = [
    { role: 'system', content: KAK_ANI_SYSTEM_PROMPT },
    { role: 'system', content: `Context: ${contextInstruction}` }
  ]

  // Inject conversation history for multi-turn context
  if (recentMessages && recentMessages.length > 0) {
    for (const msg of recentMessages) {
      messages.push({
        role: msg.role === 'bot' ? 'assistant' : 'user',
        content: msg.content
      })
    }
  }

  messages.push({ role: 'user', content: userMessage })

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 300,
        temperature: 0.7
      })
    })

    const result = await response.json()
    return result.choices?.[0]?.message?.content || "Maaf, ada masalah. Cuba lagi ye?"

  } catch (error) {
    console.error('GPT API error:', error)
    return "Alamak ada masalah teknikal. Cuba lagi sekejap ye?"
  }
}

// extractLanguageChoice() — REMOVED (dead code, was part of old language step)
// Language detection is now handled by:
//   1. resolveMirroredLanguage() in helpers.ts (per-turn mirroring in index.ts)
//   2. understandMessage().detectedLanguage in nlu.ts (NLU auto-detect)

export async function detectJobSearchIntent(message: string, lang: string): Promise<boolean> {
  const lower = message.toLowerCase().trim()

  // Exclude messages that are clearly questions
  if (lower.includes('?') || /^(apa|bila|berapa|adakah|macam mana|kenapa|siapa|is |what |how |when |where |who |why |does |do |can )/.test(lower)) {
    return false
  }

  // Strong signals: action phrases that clearly indicate wanting to search
  const strongPhrases = [
    'cari kerja', 'cari keje', 'nak kerja', 'nak keje', 'nak cari',
    'find job', 'find work', 'search job', 'job search',
    '找工作', '找工', 'cari pekerjaan'
  ]
  if (strongPhrases.some(phrase => lower.includes(phrase))) {
    return true
  }

  // Action words alone (without "kerja") — only if the message is short (likely a command)
  const actionWords = ['cari', 'find', 'search']
  if (lower.split(/\s+/).length <= 3 && actionWords.some(word => lower.includes(word))) {
    return true
  }

  return false
}
