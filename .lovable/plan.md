

## Add Branch, Status, Job Type, and End Date to Job Detail & Edit Form

### Summary
Display **Branch** and **Status** in the job detail view, and make **Branch**, **Status**, **Job Type**, and **End Date** (expire_by) editable in the edit form. End Date is already editable; the other three are not.

### Changes

#### 1. `src/pages/JobDetailPage.tsx` — Add Branch & Status to detail view
- Add **Branch** field to left column (with a building/store icon) showing `job.branch || 'Not specified'`
- Add **Status** field to right column showing `job.status` as a styled badge (active/open = green, completed = gray, cancelled = red)
- Update the header badge to use `job.status` instead of just expired/active logic
- Add `status` and `branch` to the `handleSave` update payload

#### 2. `src/components/JobEditForm.tsx` — Add Branch, Status, Job Type fields
- Add `branch`, `status`, and `job_type` to `JobEditFormData` interface
- Initialize them from `job` props
- Add **Branch** text input field
- Add **Status** select dropdown with options: `active`, `open`, `completed`, `cancelled`
- Add **Job Type** text input field
- End Date (`expire_by`) is already editable — no change needed

#### 3. `src/pages/JobDetailPage.tsx` — Include new fields in save payload
- Add `branch`, `status`, `job_type` to the `supabase.update()` call in `handleSave`

### Status Options
`active`, `open`, `completed`, `cancelled` — matching the values from the bulk import.

