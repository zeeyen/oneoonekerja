

## Fix Bot Processor: Shortcode Context, Image Handling, and Location Sharing

### Problem 1: Shortcode job context lost during onboarding

**Root cause**: When a new user types `geo-jlnkebun`, the bot finds the Jalan Kebun job and stores it in `conversation_state.shortcode_jobs`. However, when the user's location (Johan Setia) triggers the ambiguous location flow, the conversation_state gets **overwritten** at multiple points (lines 1471, 1378, 1496), losing the `shortcode_jobs` array. When the location is finally resolved, the code calls `findAndPresentJobsConversational(user)` which searches by the user's home location (Klang) instead of presenting the original Jalan Kebun shortcode jobs.

**Fix**: Preserve `shortcode_jobs` and `shortcode_type` in conversation_state throughout all location clarification branches. When location is finally resolved and `shortcode_jobs` exist, present those jobs instead of running a new proximity search.

Affected code paths in `handleOnboardingConversational` (`collect_info` step):
- Line ~1471: ambiguous location handler -- add `shortcode_jobs` to new state
- Line ~1378: geocoding failure after state selection -- add `shortcode_jobs` to new state
- Line ~1496: location text without coordinates -- add `shortcode_jobs` to new state
- Line ~1349-1371: ambiguous location resolved -- check for `shortcode_jobs` before calling `findAndPresentJobsConversational`
- Line ~1422-1447: location clarification resolved -- check for `shortcode_jobs` before calling `findAndPresentJobsConversational`

Same pattern applies to `update_location` step (lines ~1560-1760).

### Problem 2: Image messages ignored

**Root cause**: When an image is received during the matching state, `handleMatchingConversational` tries `extractJobNumber("[image message]")` which returns null, then checks `isMoreCommand` which also fails, so the bot falls through to the generic "reply with number" prompt. The user sent an image of a job listing and said "Sy nk ni" (I want this one) but the bot has no awareness of image context.

**Fix**: Add image-awareness to the bot processor:

1. In `handleMatchingConversational`: When `messageType === 'image'`, store a flag `last_image_at` in conversation_state and respond with a message asking the user to specify which job number they want (since the bot cannot view images).

2. When text like "sy nk ni" / "I want this" / "ni" arrives right after an image (check `last_image_at` timestamp within ~60 seconds), treat it as a selection intent and ask the user to clarify the job number.

3. For other states (onboarding, etc.): When an image is received, acknowledge it and redirect to the current step's expected input. For example, during `collect_info`, say "Thanks for the image, but I need your details in text form."

This is a pragmatic approach -- full image analysis via Vision API would require downloading the image from WhatsApp's media API, which is a larger feature.

### Problem 3: WhatsApp location sharing not recognized

**Root cause**: The `processWithKakAni` function receives `locationData` parameter but never uses it. When a user shares their WhatsApp location (which contains lat/lng), the bot treats the message as regular text.

**Fix**: Add location data handling at the start of `processWithKakAni` (before the step switch):

1. Check if `messageType === 'location'` and `locationData` contains valid `latitude`/`longitude`.
2. If the user is in `collect_info` or `update_location` step (waiting for location), use the shared coordinates directly:
   - Set user's latitude, longitude
   - Reverse-geocode to get city/state name (using GPT or the malaysia_locations table with nearest-point lookup)
   - Skip the text-based location extraction entirely
   - Proceed to job matching
3. If the user is in `matching` or `completed` state, treat the location share as a "search near this location" intent.

### Technical Details

**File to modify**: `supabase/functions/bot-processor/index.ts`

**Changes summary**:

1. Create a helper function `preserveShortcodeContext(existingState, newState)` that copies `shortcode_jobs` and `shortcode_type` from the old state to the new state if they exist.

2. Apply this helper at every point where `conversation_state` is overwritten in the `collect_info` and `update_location` steps.

3. At every point where jobs are resolved after location clarification, check for `shortcode_jobs` first and use them instead of calling `findAndPresentJobsConversational`.

4. Add `messageType` parameter to `handleOnboardingConversational` and `handleMatchingConversational`.

5. Add image handling logic:
   - In matching state: "Kak Ani tak boleh tengok gambar. Balas nombor (1-3) untuk pilih kerja ye."
   - In onboarding: "Terima kasih gambar tu, tapi Kak Ani perlukan maklumat dalam bentuk teks ye."
   - Store `last_image_at` timestamp for contextual follow-up detection.

6. Add location data handling at the top of `processWithKakAni`:
   - Detect `messageType === 'location'` with valid `locationData`
   - Use coordinates directly for location resolution
   - Reverse-geocode using nearest malaysia_locations entry or GPT
   - Short-circuit to job matching

7. Add a `reverseGeocode(lat, lng)` helper that finds the nearest city from the `malaysia_locations` table using coordinate distance.

