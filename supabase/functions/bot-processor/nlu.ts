// nlu.ts — Context-aware Natural Language Understanding layer
// Replaces classifyIntent() with richer output including field detection & contextual responses.
// Same GPT model (gpt-4o-mini), same 1-call cost. On error, falls back to safe defaults.

import { OPENAI_API_KEY } from './config.ts'
import type { RecentMessage } from './conversation.ts'

export type MessageType =
  | 'data_response'
  | 'question'
  | 'confusion'
  | 'job_preference'
  | 'greeting'
  | 'command'
  | 'out_of_context'
  | 'other'

export interface NLUResult {
  messageType: MessageType
  confidence: number
  detectedLanguage: 'ms' | 'en' | 'zh' | null
  extractableFields: string[]         // which profile fields appear present in this message
  contextualResponse: string | null   // GPT response for questions/confusion (saves a generateKakAniResponse call)
  shouldExtract: boolean              // whether to run extraction pipeline
}

export interface NLUContext {
  currentStep: string
  missingFields: string[]
  hasName: boolean
  hasAge: boolean
  hasGender: boolean
  hasLocation: boolean
  userName?: string
  lang: string
}

const SAFE_DEFAULT: NLUResult = {
  messageType: 'data_response',
  confidence: 0.5,
  detectedLanguage: null,
  extractableFields: [],
  contextualResponse: null,
  shouldExtract: true
}

/**
 * Context-aware message understanding.
 * Replaces classifyIntent() — same single GPT call, richer output.
 */
export async function understandMessage(
  message: string,
  context: NLUContext,
  recentMessages?: RecentMessage[]
): Promise<NLUResult> {
  try {
    const { currentStep, missingFields, hasName, hasAge, hasGender, hasLocation, userName, lang } = context

    // Build conversation history snippet (last 2-3 turns)
    let historySnippet = ''
    if (recentMessages && recentMessages.length > 0) {
      const recent = recentMessages.slice(-3)
      historySnippet = recent.map(m =>
        `${m.role === 'user' ? 'User' : 'Bot'}: ${(m.content || '').substring(0, 120)}`
      ).join('\n')
    }

    // Build collected/missing profile summary
    const collected: string[] = []
    if (hasName) collected.push(`name=${userName || 'yes'}`)
    if (hasAge) collected.push('age=yes')
    if (hasGender) collected.push('gender=yes')
    if (hasLocation) collected.push('location=yes')
    const missingStr = missingFields.length > 0 ? missingFields.join(', ') : 'NONE (all collected)'

    const systemPrompt = `You are the NLU component of a Malaysian job-search WhatsApp bot ("Kak Ani").
Analyze the user's message and return ONLY a JSON object.

CONTEXT:
- Current step: ${currentStep}
- Collected fields: ${collected.join(', ') || 'none'}
- Missing fields: ${missingStr}
- User language preference: ${lang}
${historySnippet ? `- Recent conversation:\n${historySnippet}` : ''}

RETURN THIS JSON FORMAT:
{
  "messageType": "data_response|question|confusion|job_preference|greeting|command|out_of_context|other",
  "confidence": 0.0-1.0,
  "detectedLanguage": "ms"|"en"|"zh"|null,
  "extractableFields": ["name","age","gender","location"],
  "contextualResponse": "...",
  "shouldExtract": true|false
}

CLASSIFICATION RULES:
1. "data_response" — User is providing profile data (name, age, gender, location). Set extractableFields to the fields you detect in the message. Examples:
   - "Ahmad" when name is missing → extractableFields: ["name"]
   - "25" when age is missing → extractableFields: ["age"]
   - "Shah Alam, Selangor" → extractableFields: ["location"]
   - "Ahmad, 25, lelaki, KL" → extractableFields: ["name","age","gender","location"]
   - IMPORTANT: A single word that looks like a name AND name is missing → data_response with ["name"]
   - IMPORTANT: A number 15-65 AND age is missing → data_response with ["age"]
   - IMPORTANT: "lelaki"/"perempuan"/"male"/"female" AND gender is missing → data_response with ["gender"]

2. "question" — User asks about jobs, salary, process, requirements, etc. Set shouldExtract=false. Provide contextualResponse: a brief (1-3 line) answer in ${lang === 'zh' ? 'Simplified Chinese' : lang === 'en' ? 'English' : 'casual Malay'}, in Kak Ani's warm voice. Then redirect: mention the missing fields if any.

3. "confusion" — User is confused/frustrated ("apa ni", "tak faham", "huh"). Set shouldExtract=false. Provide contextualResponse: empathetic 1-2 line reply redirecting them, asking for ONE missing field.

4. "job_preference" — User expresses what job they want ("nak kerja warehouse", "F&B"). shouldExtract=false. Provide contextualResponse acknowledging their preference and redirecting.

5. "greeting" — "hi", "hello", "assalamualaikum", "ok", simple ack. shouldExtract=false. contextualResponse: brief warm reply + redirect to missing fields.

6. "command" — "lagi", "more", "restart", "semula", number selection. shouldExtract=false. No contextualResponse needed.

7. "out_of_context" — Completely off-topic. shouldExtract=false. Provide contextualResponse redirecting gently.

IMPORTANT FIELD DETECTION RULES:
- If the message is a SINGLE word or short phrase and matches a missing field type, classify as data_response with that field.
- If a message contains data for SOME fields but not all, list ONLY the fields actually present.
- For location: city names, state names, "area X", "dekat Y", address-like text → ["location"]
- For structured data like "Ali, 25, male, KL" → all 4 fields.
- DO NOT put fields in extractableFields if the user is asking ABOUT them (e.g., "what location?" is a question, not location data).

CONTEXTUAL RESPONSE RULES:
- Use ${lang === 'zh' ? 'Simplified Chinese' : lang === 'en' ? 'English' : 'casual Malay (with light bahasa pasar)'}
- Be warm, brief (1-3 lines max)
- ${userName ? `Call user "${userName}"` : 'Call user "adik"'}
- For questions: answer briefly, then redirect to missing info
- For confusion: be empathetic, simplify, ask for just ONE field
- Set contextualResponse to null for data_response and command types`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 250,
        temperature: 0
      })
    })

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content?.trim() || '{}'
    const jsonMatch = content.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const nluResult: NLUResult = {
        messageType: parsed.messageType || 'data_response',
        confidence: parsed.confidence ?? 0.5,
        detectedLanguage: ['ms', 'en', 'zh'].includes(parsed.detectedLanguage) ? parsed.detectedLanguage : null,
        extractableFields: Array.isArray(parsed.extractableFields) ? parsed.extractableFields : [],
        contextualResponse: parsed.contextualResponse || null,
        shouldExtract: parsed.shouldExtract !== false  // default true
      }
      console.log(`🧠 NLU: ${nluResult.messageType} (${nluResult.confidence}), fields=[${nluResult.extractableFields}], extract=${nluResult.shouldExtract}, lang=${nluResult.detectedLanguage} for "${message.substring(0, 40)}..."`)
      return nluResult
    }
  } catch (error) {
    console.error('NLU understandMessage error:', error)
  }

  // Safe fallback — identical behavior to old classifyIntent default
  console.log(`⚠️ NLU fallback: treating as data_response for "${message.substring(0, 40)}..."`)
  return { ...SAFE_DEFAULT }
}
