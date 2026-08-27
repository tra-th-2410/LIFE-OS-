
-- Security fix: tighten notifications INSERT policy
-- Previously WITH CHECK (true) allowed any authenticated user to insert
-- notifications for arbitrary user_id values. The SECURITY DEFINER
-- functions that create notifications bypass RLS, so this change does
-- not affect them. Direct client inserts are now restricted to own user_id.

DROP POLICY IF EXISTS notif_insert ON notifications;

CREATE POLICY "notif_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
