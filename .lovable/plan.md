
## Fix: Job Edit "Save Changes" Failing

### Root Cause
The database error is: `invalid input syntax for type uuid: "me@dannygoh.com"`

In `src/pages/JobDetailPage.tsx` line 98, the update passes:
```
last_edited_by: user.email
```

But `last_edited_by` is a UUID column with a foreign key to `admin_users.id`. It expects a UUID like the user's auth ID, not an email string.

### Fix

**File: `src/pages/JobDetailPage.tsx`**
- Change line 98 from `last_edited_by: user.email` to `last_edited_by: user.id`

That single line change resolves the issue. The `user` object from `useAuth()` contains both `.id` (UUID) and `.email` (string) -- the column needs the UUID.
