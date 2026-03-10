

## Implementation Plan

### 1. Update endnote in `matching.ts` (lines 205-208)
Replace the `⚠️ PENTING/IMPORTANT/重要` disclaimer with Option D (Encouraging):
- **MS:** `Lepas ni klik link tu dan daftar ye. Kak Ani doakan adik dapat kerja ni! 💪`
- **EN:** `Click the link and register next. Rooting for you! 💪`
- **ZH:** `接下来点击链接注册吧。加油，祝你成功！💪`

### 2. Update endnote in `job-selections.ts` (lines 94-98)
Replace the `📝 Gentle nudge` disclaimer with matching Option D tone:
- **MS:** `\n━━━━━━━━━━━━━━━━━━━━\nJangan lupa klik link dan daftar ye. Kak Ani doakan adik dapat! 💪`
- **EN:** `\n━━━━━━━━━━━━━━━━━━━━\nDon't forget to click the link and register. Rooting for you! 💪`
- **ZH:** `\n━━━━━━━━━━━━━━━━━━━━\n别忘了点击链接注册哦。加油，祝你成功！💪`

### 3. Fix copy-paste template extraction in `normalize.ts`
Extend `stripBotTemplate()` to detect the bot's bullet-point format users copy-paste back:

```
Boleh bagitahu Kak Ani:
- Nama penuh : KOHGULAN RAMESH
- Umur : 21
- Lelaki/Perempuan : Lelaki
- Duduk mana (bandar, negeri) : Mantin, Negeri Sembilan
```

Add a new detection block before the existing label check that:
- Matches lines starting with `- <label> : <value>` (with optional parenthetical hints)
- Expanded labels: `nama penuh`, `nama`, `full name`, `name`, `umur`, `age`, `lelaki/perempuan`, `jantina`, `gender`, `duduk mana`, `lokasi`, `location`
- Strips preamble lines (anything without a `- Label :` pattern)
- Outputs: `KOHGULAN RAMESH, 21, Lelaki, Mantin, Negeri Sembilan`

### 4. Deploy edge function

### Files changed

| File | Change |
|------|--------|
| `normalize.ts` | Add bullet-point template detection |
| `matching.ts` | Replace endnote with Option D |
| `job-selections.ts` | Replace endnote with Option D |

