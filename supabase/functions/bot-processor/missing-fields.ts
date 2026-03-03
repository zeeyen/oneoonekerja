// missing-fields.ts — Missing field detection and prompting

import { getText } from './helpers.ts'
import type { ExtractedInfo } from './types.ts'

export function getMissingFields(info: ExtractedInfo): string[] {
  const missing: string[] = []
  if (!info.name) missing.push('name')
  if (!info.age) missing.push('age')
  if (!info.gender) missing.push('gender')
  if (!info.city && !info.state) missing.push('location')
  return missing
}

export function askOneMissingField(field: string, lang: string): string {
  if (field === 'name') {
    return getText(lang, {
      ms: `Takpe, kita buat satu-satu ya. Nama penuh adik apa?`,
      en: `No worries, let's do it one by one. What's your full name?`,
      zh: `没关系，我们一步一步来。请告诉我您的全名？`
    })
  }
  if (field === 'age') {
    return getText(lang, {
      ms: `Baik, sekarang umur adik berapa?`,
      en: `Great, how old are you now?`,
      zh: `好的，您今年几岁？`
    })
  }
  if (field === 'gender') {
    return getText(lang, {
      ms: `Sekarang jantina adik: lelaki atau perempuan?`,
      en: `Now your gender: male or female?`,
      zh: `现在请告诉我您的性别：男或女？`
    })
  }
  return getText(lang, {
    ms: `Tinggal lokasi je. Adik duduk kat mana? (bandar + negeri)\n\nContoh: "Nilai, Negeri Sembilan"\nAtau boleh share pin lokasi WhatsApp.`,
    en: `Only location left. Where do you live now? (city + state)\n\nExample: "Nilai, Negeri Sembilan"\nOr share your WhatsApp location pin.`,
    zh: `只差地点了。您现在住哪里？（城市 + 州）\n\n例如："Nilai, Negeri Sembilan"\n也可以分享 WhatsApp 位置。`
  })
}

export function askForMissingInfo(missing: string[], lang: string, partial: ExtractedInfo): string {
  const got: string[] = []
  if (partial.name) got.push(lang === 'zh' ? `名字: ${partial.name}` : lang === 'en' ? `Name: ${partial.name}` : `Nama: ${partial.name}`)
  if (partial.age) got.push(lang === 'zh' ? `年龄: ${partial.age}` : lang === 'en' ? `Age: ${partial.age}` : `Umur: ${partial.age}`)
  if (partial.gender) {
    const g = partial.gender === 'male'
      ? (lang === 'zh' ? '男' : lang === 'en' ? 'Male' : 'Lelaki')
      : (lang === 'zh' ? '女' : lang === 'en' ? 'Female' : 'Perempuan')
    got.push(lang === 'zh' ? `性别: ${g}` : lang === 'en' ? `Gender: ${g}` : `Jantina: ${g}`)
  }
  if (partial.city) got.push(lang === 'zh' ? `地点: ${partial.city}` : lang === 'en' ? `Location: ${partial.city}` : `Lokasi: ${partial.city}`)

  const missingText: Record<string, { ms: string, en: string, zh: string }> = {
    name: { ms: 'nama', en: 'your name', zh: '名字' },
    age: { ms: 'umur', en: 'age', zh: '年龄' },
    gender: { ms: 'lelaki ke perempuan', en: 'male or female', zh: '男还是女' },
    location: { ms: 'duduk mana', en: 'where you live', zh: '住哪里' }
  }

  const missingList = missing.map(m => getText(lang, missingText[m])).join(', ')

  if (got.length > 0) {
    const gotStr = got.join('\n')
    return getText(lang, {
      ms: `Ok noted!\n${gotStr}\n\nEh tapi Kak Ani nak tahu lagi: ${missingList}`,
      en: `Got it!\n${gotStr}\n\nBut I still need to know: ${missingList}`,
      zh: `好的！\n${gotStr}\n\n不过我还想知道：${missingList}`
    })
  }

  return getText(lang, {
    ms: `Eh tak faham la tu. Cuba bagitahu Kak Ani:\n- Nama adik\n- Umur berapa\n- Lelaki ke perempuan\n- Duduk kat mana\n\nContoh: "Ali, 25, lelaki, Puchong"`,
    en: `Hmm didn't quite get that. Can you tell me:\n- Your name\n- How old you are\n- Male or female\n- Where you live\n\nLike: "Ali, 25, male, Puchong"`,
    zh: `嗯，没太听懂。可以告诉我：\n- 你的名字\n- 多大了\n- 男还是女\n- 住在哪里\n\n比如："Ali, 25, 男, Puchong"`
  })
}
