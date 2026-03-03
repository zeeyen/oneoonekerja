// conversation.ts — Conversation history buffer and session expired messages

import { getText } from './helpers.ts'

export interface RecentMessage {
  role: 'bot' | 'user'
  content: string
}

export function addToRecentMessages(
  convState: Record<string, any>,
  userMsg: string,
  botMsg: string
): RecentMessage[] {
  const recent: RecentMessage[] = convState.recent_messages || []
  recent.push({ role: 'user', content: userMsg.substring(0, 200) })
  recent.push({ role: 'bot', content: botMsg.substring(0, 200) })
  // Keep only last 3 turns (6 entries)
  while (recent.length > 6) recent.shift()
  return recent
}

export const SESSION_EXPIRED_MESSAGES = {
  ms: (name: string, data: any) => `Hai ${name}, lama tak jumpa!

Sesi sebelum dah tamat. Ni info yang ada:
📍 Lokasi: ${data.location_city || 'Tak letak'}, ${data.location_state || 'Tak letak'}
👤 Umur: ${data.age || 'Tak letak'} | Jantina: ${data.gender === 'male' ? 'Lelaki' : data.gender === 'female' ? 'Perempuan' : 'Tak letak'}

Nak buat apa?
1. Tengok kerja guna info lama
2. Start baru dengan info baru

Balas *1* atau *2*`,

  en: (name: string, data: any) => `Welcome back, ${name}!

Your previous session has expired. Here's what we had:
📍 Location: ${data.location_city || 'Not specified'}, ${data.location_state || 'Not specified'}
👤 Age: ${data.age || 'Not specified'} | Gender: ${data.gender === 'male' ? 'Male' : data.gender === 'female' ? 'Female' : 'Not specified'}

Would you like to:
1. See jobs matching your previous criteria
2. Start fresh with new information

Reply with *1* or *2*`,

  zh: (name: string, data: any) => `欢迎回来，${name}！

您之前的会话已过期。这是您的信息：
📍 地点：${data.location_city || '未指定'}，${data.location_state || '未指定'}
👤 年龄：${data.age || '未指定'} | 性别：${data.gender === 'male' ? '男' : data.gender === 'female' ? '女' : '未指定'}

您想要：
1. 查看符合之前条件的工作
2. 重新开始输入新信息

请回复 *1* 或 *2*`
}
