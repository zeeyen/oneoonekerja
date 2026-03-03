// normalize.ts — Pre-processing for user messages before GPT/extraction
// Zero-cost (no GPT, no DB) — pure string manipulation.

/**
 * Strip bot template copy-paste patterns.
 * Users sometimes copy-paste the bot's own output back.
 * e.g. "Ok noted!\nNama: Ahmad\nUmur: 25\nJantina: Lelaki\nLokasi: KL"
 * → "Ahmad, 25, Lelaki, KL"
 */
export function stripBotTemplate(message: string): string {
  const trimmed = message.trim()

  // Check if message looks like a copy-pasted bot template with labeled fields
  // Pattern: lines starting with field labels like "Nama:", "Umur:", "Name:", "Age:", etc.
  const labelPattern = /^(nama|name|umur|age|jantina|gender|lokasi|location|city|bandar|negeri|state|姓名|年龄|性别|地点)\s*[:=]\s*/gmi
  const labelMatches = trimmed.match(labelPattern)

  if (labelMatches && labelMatches.length >= 2) {
    // Extract values after labels, join with commas
    const lines = trimmed.split(/[\n\r]+/)
    const values: string[] = []
    for (const line of lines) {
      const match = line.match(/^(?:ok\s*(?:noted|dah|got|baik)[\s!.]*|(?:nama|name|umur|age|jantina|gender|lokasi|location|city|bandar|negeri|state|姓名|年龄|性别|地点)\s*[:=]\s*)/i)
      if (match) {
        const value = line.slice(match[0].length).trim()
        if (value) values.push(value)
      } else {
        // Line without a label — skip preamble lines like "Ok noted!"
        const cleaned = line.replace(/^ok\s*(noted|dah|got|baik)[\s!.]*/i, '').trim()
        if (cleaned) values.push(cleaned)
      }
    }
    if (values.length >= 2) {
      return values.join(', ')
    }
  }

  // Strip standalone preamble ("Ok noted!", "Baik!", etc.) at the start
  const withoutPreamble = trimmed.replace(/^(?:ok\s*(?:noted|dah|got|baik)|baik|noted|got it)[\s!.]*\n?/i, '').trim()

  return withoutPreamble || trimmed
}

/**
 * Normalize separators for structured data.
 * "Arfah.29.lelaki.nilai" → "Arfah, 29, lelaki, nilai"
 * "Ahmad|25|male|KL" → "Ahmad, 25, male, KL"
 * Multi-line short segments → comma-separated
 */
export function normalizeSeparators(message: string): string {
  let result = message.trim()

  // Dots → commas when structured (2+ dots, not a sentence-ending period, not a URL)
  const dotCount = (result.match(/\./g) || []).length
  const looksStructuredDots =
    dotCount >= 2 &&
    !/\s*\.\s*$/.test(result) &&       // not ending with period
    !/https?:\/\//i.test(result) &&     // not a URL
    !/\.\s+[A-Z]/g.test(result)         // not sentence boundaries (". Next sentence")

  if (looksStructuredDots) {
    result = result.replace(/\./g, ', ')
  }

  // Pipes → commas when 2+ pipes present
  if ((result.match(/\|/g) || []).length >= 2) {
    result = result.replace(/\|/g, ', ')
  }

  // Slashes → commas when 2+ slashes (but not URLs or dates like 01/01/2000)
  const slashCount = (result.match(/\//g) || []).length
  if (slashCount >= 2 && !/https?:\/\//i.test(result) && !/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(result)) {
    result = result.replace(/\//g, ', ')
  }

  // Multi-line → commas when each line is short (under 40 chars) and 2+ lines
  const lines = result.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean)
  if (lines.length >= 2 && lines.every(l => l.length < 40)) {
    result = lines.join(', ')
  }

  // Collapse multiple commas/spaces
  result = result.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim()

  return result
}

/**
 * Main normalization entry point.
 * Call at the top of every handler before any GPT or extraction call.
 */
export function normalizeInput(message: string): string {
  let result = message.trim()

  // Step 1: Strip bot template copy-paste
  result = stripBotTemplate(result)

  // Step 2: Normalize separators
  result = normalizeSeparators(result)

  return result
}
