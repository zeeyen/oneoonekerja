// intent.ts — Intent classification using GPT-4o-mini
// ⚠️ DEPRECATED: Replaced by understandMessage() in nlu.ts
// Kept as rollback safety net. If nlu.ts breaks, re-import classifyIntent in handlers.

import { OPENAI_API_KEY } from './config.ts'

export type UserIntent = 'data_response' | 'question' | 'confusion' | 'job_preference' | 'greeting' | 'other'

export async function classifyIntent(
  message: string,
  currentStep: string,
  lang: string
): Promise<{ intent: UserIntent, confidence: number }> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Classify the user's intent. They are currently in step '${currentStep}' of a job-finding WhatsApp chatbot in Malaysia. The bot collects name, age, gender, and location.

Return ONLY JSON: {"intent": "...", "confidence": 0.0-1.0}

Intents:
- "data_response": User is providing personal info (name, age, gender, location) as requested. Includes comma-separated data like "Ali, 25, lelaki, KL". Also includes single-field answers like just a name, age number, or location.
- "question": User is asking about jobs, the process, what the bot does, salary, requirements, etc.
- "confusion": User is confused, frustrated, doesn't understand, says things like "apa ni", "tak faham", "huh", expresses frustration.
- "job_preference": User is expressing what kind of work they want, industry preference, salary expectations. E.g. "nak kerja warehouse", "minat F&B".
- "greeting": Casual greeting, "hi", "hello", "assalamualaikum", acknowledgment like "ok", "noted".
- "other": Anything else.

Important: If the message contains structured data (name + age + gender + location pattern), ALWAYS classify as "data_response" regardless of other content.
If the message is just a number, classify as "data_response".
If message is in Malay, English, or Chinese - classify based on meaning, not language.`
          },
          { role: 'user', content: message }
        ],
        max_tokens: 50,
        temperature: 0
      })
    })

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content?.trim() || '{}'
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      console.log(`🧠 Intent: ${parsed.intent} (${parsed.confidence}) for "${message.substring(0, 40)}..."`)
      return { intent: parsed.intent || 'other', confidence: parsed.confidence || 0.5 }
    }
  } catch (error) {
    console.error('Intent classification error:', error)
  }
  return { intent: 'data_response', confidence: 0.5 } // Default: treat as data
}
