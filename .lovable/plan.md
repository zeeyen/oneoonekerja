

## Update Escalation Footer and System Prompt for Friendlier Tone

### Changes

**1. helpers.ts — Update getEscalationFooter messages (lines 100-102)**

Replace the three language strings with friendlier, more casual versions:

```typescript
ms: `\n\nKalau ada apa-apa, boleh je WhatsApp kitorang ye:\n📱 wa.me/60162066861\n📧 info@101kerja.com`,
en: `\n\nIf you need anything, just reach out to us anytime:\n📱 wa.me/60162066861\n📧 info@101kerja.com`,
zh: `\n\n有什么需要随时联系我们哦：\n📱 wa.me/60162066861\n📧 info@101kerja.com`
```

**2. config.ts — Update rule #7 in KAK_ANI_SYSTEM_PROMPT (line 41)**

Change from:
```
7. Kalau user minta bercakap dengan manusia/admin/support/human, atau minta nombor telefon/contact, WAJIB beri info ni:\n   📱 WhatsApp: wa.me/60162066861\n   📧 Email: info@101kerja.com\n   Jangan elak atau deflect - terus bagi contact.
```

To:
```
7. Kalau user minta bercakap dengan manusia/admin/support/human, atau minta nombor telefon/contact, bagi info ni dengan cara yang mesra dan manja:\n   📱 WhatsApp: wa.me/60162066861\n   📧 Email: info@101kerja.com\n   Jangan elak atau deflect. Bagi contact terus, tapi cara Kak Ani - santai dan caring.
```

### Deployment
Redeploy the `bot-processor` Edge Function after both edits.

