

## Shortcode Commands: `geo-xxxx` and `com-xxxx`

### Overview
When a **new user's first message** starts with `geo-` or `com-`, the bot skips the normal language/onboarding flow and instead:
1. Parses the shortcode to extract a location or company name
2. Uses fuzzy matching to find jobs by location or company
3. Displays matching jobs
4. Then asks for Name, Age, Gender, and Location to complete registration

### How It Works

**Detection**: In the main handler (around line 540), before `processWithKakAni`, detect if the message matches `geo-xxxx` or `com-xxxx` patterns. This runs for users in ANY onboarding status (new or otherwise).

**Fuzzy matching heuristics**:
- Remove hyphens, expand the slug (e.g., `jlnkebun` -> `jln kebun`, `sgbuloh` -> `sg buloh`)
- Common Malaysian abbreviations: `sg` = Sungai, `bt` = Batu, `jln` = Jalan, `tmn` = Taman, `bdr` = Bandar, `kpg` = Kampung
- For `geo-`: Match against `location_city`, `location_address`, `location_state` columns using case-insensitive `ILIKE` with `%` wildcards
- For `com-`: Match against the `company` column using `ILIKE` with `%` wildcards
- Only show non-expired jobs

**Response format**:
- Show the matching jobs list (reusing `formatJobsMessage`)
- After the job list, append a prompt asking for Name, Age, Gender, and Location
- Set `onboarding_status = 'in_progress'`, `onboarding_step = 'collect_info'`
- Store matched jobs in `conversation_state` so the user can select a job number after providing their info

### Changes (all in `supabase/functions/bot-processor/index.ts`)

#### 1. Add shortcode detection function
```
function detectShortcode(message: string): { type: 'geo' | 'com', slug: string } | null
```
- Matches `^(geo|com)-(.+)$` (case-insensitive)
- Returns the type and raw slug

#### 2. Add slug expansion function
```
function expandSlug(slug: string): string
```
- Insert spaces between known abbreviation prefixes and the rest
- Map common abbreviations: `sg` -> `sungai`, `bt` -> `batu`, `jln` -> `jalan`, `tmn` -> `taman`, `bdr` -> `bandar`, `kpg` -> `kampung`, `pj` -> `petaling jaya`, etc.
- Return the expanded, human-readable search term

#### 3. Add shortcode job search function
```
async function handleShortcodeSearch(user: User, type: 'geo' | 'com', slug: string): Promise<{ response: string, updatedUser: User }>
```
- Expand the slug into a search term
- Query `jobs` table with `ILIKE` filters:
  - `geo`: `location_city.ilike.%term%` OR `location_address.ilike.%term%`
  - `com`: `company.ilike.%term%`
- Filter non-expired jobs only
- Format matching jobs using `formatJobsMessage`
- If no jobs found, show "no jobs found for X" message and fall through to normal onboarding
- If jobs found:
  - Set user state to `in_progress` / `collect_info` with `conversation_state: { shortcode_jobs: [...matchedJobs], shortcode_type: type }`
  - Append info collection prompt after job list
  - After user provides info (handled by existing `collect_info` step), transition to `matching` with the shortcode jobs pre-loaded

#### 4. Integrate into main handler
- In the main `serve` handler, after profanity/ban checks but before `processWithKakAni`, add:
```
const shortcode = detectShortcode(message)
if (shortcode) {
  const result = await handleShortcodeSearch(user, shortcode.type, shortcode.slug)
  return jsonResponse(result)
}
```

#### 5. Update `collect_info` step to handle shortcode flow
- After info collection is complete (all fields present), check if `conversation_state.shortcode_jobs` exists
- If yes: skip the normal `findAndPresentJobsConversational` call and instead transition directly to `matching` status with the pre-loaded shortcode jobs
- The user can then select jobs by number as usual

### Example Flows

**`geo-sgbuloh`**:
1. Slug expands to "sungai buloh"
2. Query: `jobs.location_city ILIKE '%sungai buloh%'`
3. Bot shows: "Found 5 jobs in Sungai Buloh: [job list]"
4. Bot asks: "To apply, please tell me your Name, Age, Gender, and Location"
5. User replies with info -> stored -> can now select job numbers

**`com-bbsmgmt`**:
1. Slug expands to "bbs mgmt" (or fuzzy-matched as-is)
2. Query: `jobs.company ILIKE '%bbs%mgmt%'` (split words into separate wildcards)
3. Bot shows: "Found 3 jobs at BBS Management: [job list]"
4. Same info collection flow

### Technical Details

**Fuzzy ILIKE strategy**: Split the expanded slug into words and join with `%` for the ILIKE pattern. E.g., "bbs mgmt" becomes `%bbs%mgmt%`. This handles partial matches and word-order variations.

**Language detection**: Since this is the user's first message and no language is set yet, the bot will default to Malay (`ms`) for the job list and info prompt. The user's language will be detected from their info reply.

**State machine**: The shortcode flow reuses the existing `collect_info` step, just with pre-loaded jobs. No new onboarding steps are needed.

