-- Admin actions audit log for moderation tracking
CREATE TABLE IF NOT EXISTS admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('ban', 'unban', 'extend_ban')),
  target_user_id uuid REFERENCES applicants(id) ON DELETE CASCADE NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (admins) to insert and read
CREATE POLICY "Admins can insert actions"
  ON admin_actions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Admins can read actions"
  ON admin_actions FOR SELECT
  TO authenticated
  USING (true);

-- Index for fast lookups by target user
CREATE INDEX idx_admin_actions_target_user ON admin_actions(target_user_id, created_at DESC);
