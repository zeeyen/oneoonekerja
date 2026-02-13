

## Add Conversation Download to Applicant Detail Page

### Overview
Add a "Download Conversation" button in the Conversation History tab that exports the full chat log as a CSV file with timestamps.

### Changes

**File: `src/pages/ApplicantDetailPage.tsx`**

1. Add a `Download` icon import from `lucide-react`
2. Add a `handleDownloadConversation` function that:
   - Takes the already-loaded `conversations` array
   - Generates a CSV with columns: **Date, Time, Direction, Message Type, Content**
   - Formats timestamps using `date-fns` `format()` (e.g., `2025-01-15` and `14:32:05`)
   - Escapes CSV special characters (commas, quotes, newlines) in message content
   - Triggers a browser file download named `conversation_{applicant_name}_{date}.csv`
3. Add a "Download CSV" `Button` next to the "Conversation History" tab content header, visible only when conversations exist

### CSV Output Format
```
Date,Time,Direction,Type,Content
2025-01-15,14:32:05,inbound,text,"Hi saya nak cari kerja"
2025-01-15,14:32:08,outbound,text,"Hai! Saya Kak Ani..."
```

### Technical Notes
- Reuses the already-fetched `conversations` data from `useApplicantConversations` -- no additional API call needed
- Follows the same CSV generation pattern used in the Applicants page export
- No new files needed; single file modification only
