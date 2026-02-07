

## Fix: Blank Screen on Applicant Detail Page

### Problem
When an admin clicks on an applicant row in `/applicants`, the detail page (`/applicants/:id`) shows a blank screen. This is caused by a **runtime crash** when the component tries to access nullable database fields as if they were always present.

The database allows `null` for `availability` (jsonb), `preferred_job_types` (text[]), and `preferred_positions` (text[]), but the code calls methods like `Object.entries()` and `.length` on them without null checks. Since there is no React error boundary, the crash produces a blank white screen with no visible error message.

### Changes

**1. Add null-safe defaults in `ApplicantDetailPage.tsx`**

Update the component to safely handle null values for:
- `applicant.availability` -- default to `{}` if null
- `applicant.preferred_job_types` -- default to `[]` if null  
- `applicant.preferred_positions` -- default to `[]` if null
- `applicant.years_experience` -- default to `0` if null

Specifically:
- Change `formatAvailability(applicant.availability)` to `formatAvailability(applicant.availability ?? {})`
- Change `applicant.preferred_job_types.length` to `(applicant.preferred_job_types ?? []).length`
- Change `applicant.preferred_job_types.map(...)` to `(applicant.preferred_job_types ?? []).map(...)`
- Same pattern for `preferred_positions`

**2. Add a React Error Boundary to `App.tsx`**

Wrap the main routes in an error boundary component so that if any future crash occurs, users see a friendly error message with a retry button instead of a blank screen.

**3. Update the `Applicant` TypeScript type in `src/types/database.ts`**

Mark nullable array/object fields as optional or union with `null` to match the actual database schema, preventing similar issues in the future:
- `preferred_job_types: string[]` becomes `string[] | null`
- `preferred_positions: string[]` becomes `string[] | null`  
- `availability: Record<string, boolean>` becomes `Record<string, boolean> | null`

### Technical Details

Files to modify:
- `src/pages/ApplicantDetailPage.tsx` -- add null-safe access for nullable fields
- `src/types/database.ts` -- update `Applicant` interface to allow null for array/object fields
- `src/App.tsx` -- add a top-level React error boundary
- `src/pages/ApplicantsPage.tsx` -- add null guards for the same fields used in the list view

