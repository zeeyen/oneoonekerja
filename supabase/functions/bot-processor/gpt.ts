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
  const lower = message.toLowerCase()
  const searchWords = ['cari', 'kerja', 'job', 'keje', 'find', 'search', '找工作', '工作', 'pekerjaan']
  return searchWords.some(word => lower.includes(word))
}
