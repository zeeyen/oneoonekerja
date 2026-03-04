

## Tone Down the Job Selection Disclaimer

The current disclaimer uses urgent, serious language ("WAJIB", "MUST", caps, exclamation marks). Here are 3 softer alternatives across all 3 languages:

### Option A — Friendly reminder
| Lang | Text |
|------|------|
| MS | `💡 *Tip:* Klik link kat atas dan daftar kat website tu ye untuk lengkapkan permohonan. Semoga berjaya! 🤞` |
| EN | `💡 *Tip:* Click the link above and register on the website to complete your application. Good luck! 🤞` |
| ZH | `💡 *提示：* 点击上面的链接并在网站上注册以完成申请。祝好运！🤞` |

### Option B — Gentle nudge (Kak Ani voice)
| Lang | Text |
|------|------|
| MS | `📝 Lepas pilih, jangan lupa klik link dan daftar kat website ye. Baru permohonan adik lengkap! 😊` |
| EN | `📝 After selecting, don't forget to click the link and register on the website to complete your application! 😊` |
| ZH | `📝 选择后，别忘了点击链接并在网站上注册，这样申请才算完成哦！😊` |

### Option C — Minimal
| Lang | Text |
|------|------|
| MS | `👆 Klik link dan daftar kat website untuk hantar permohonan ye.` |
| EN | `👆 Click the link and register on the website to submit your application.` |
| ZH | `👆 点击链接并在网站上注册以提交申请。` |

### Change
**File:** `supabase/functions/bot-processor/job-selections.ts` (lines 94-97) — replace the disclaimer text with the chosen option.

Pick whichever tone feels right and I'll update it.

