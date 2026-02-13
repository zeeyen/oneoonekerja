

## ✅ COMPLETED: Fix Bot Processor: Shortcode Context, Image Handling, and Location Sharing

All three fixes have been implemented and deployed.

### Changes Made

1. **Shortcode context preservation** - Added `preserveShortcodeContext()` helper applied at all 6 state overwrite points in `collect_info` and `update_location` steps. When location resolves with shortcode_jobs present, those jobs are presented instead of running a new proximity search.

2. **Image message handling** - Added detection for `messageType === 'image'` in matching (stores `last_image_at`, asks for job number), onboarding (acknowledges, asks for text), and other states. Added `isSelectionIntent()` to detect post-image "I want this" messages within 2 minutes.

3. **WhatsApp location sharing** - Added `reverseGeocode()` helper using `malaysia_locations` table nearest-point lookup. Handles `messageType === 'location'` with `locationData` in `collect_info`, `update_location`, `matching`, and `completed` states.
