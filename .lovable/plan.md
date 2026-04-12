

## Add Human Escalation Rule to Kak Ani System Prompt

### Change
**File**: `supabase/functions/bot-processor/config.ts`

**Line 40** — after rule #6, insert rule #7:

```
6. JANGAN guna emoji - buat natural macam manusia
7. Kalau user minta bercakap dengan manusia/admin/support/human, atau minta nombor telefon/contact, WAJIB beri info ni:\n   📱 WhatsApp: wa.me/60162066861\n   📧 Email: info@101kerja.com\n   Jangan elak atau deflect - terus bagi contact.
```

### Deployment
Redeploy the `bot-processor` Edge Function after the edit.

