
# Add WhatsApp Shortlinks to Phone Numbers

## Overview
Make every phone number displayed in the admin portal clickable, linking to `https://wa.me/<number>` so admins can quickly message applicants on WhatsApp.

## Changes

### 1. Create a shared `PhoneLink` component
A small reusable component in `src/components/PhoneLink.tsx` that:
- Accepts a phone number string (or null)
- Strips non-digit characters to build the `wa.me` link
- Renders a clickable link with the formatted phone number
- Opens in a new tab
- Styled with a subtle hover effect and WhatsApp-green accent

### 2. Update all 5 phone number display locations

| Page | File | What changes |
|------|------|-------------|
| Dashboard | `src/pages/Dashboard.tsx` (line 205) | Replace `{formatPhoneNumber(...)}` with `<PhoneLink>` |
| Applicants list | `src/pages/ApplicantsPage.tsx` (line 302) | Replace `{applicant.phone_number}` with `<PhoneLink>` |
| Applicant detail | `src/pages/ApplicantDetailPage.tsx` (line 116) | Replace plain `<span>` with `<PhoneLink>` |
| Conversations | `src/pages/ConversationsPage.tsx` (line 337) | Replace `{conv.phone_number}` with `<PhoneLink>` |
| Job detail (matches) | `src/pages/JobDetailPage.tsx` (line 359) | Replace `{match.applicant?.phone_number}` with `<PhoneLink>` |

## Technical Details

The `PhoneLink` component will:
- Strip all non-digit characters to create the wa.me URL (e.g., `+60 12-345 6789` becomes `wa.me/60123456789`)
- Keep the existing `formatPhoneNumber` display format from Dashboard for consistent formatting across all pages
- Use `<a href="https://wa.me/..." target="_blank" rel="noopener noreferrer">` for the link
- Use `e.stopPropagation()` on click to prevent triggering parent row click handlers (important for table rows that navigate on click)
- Return `-` for null/empty phone numbers
