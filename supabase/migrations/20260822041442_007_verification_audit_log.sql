/*
# Verification Audit Log

## Overview
Creates an audit log table to track every admin action on student verification
requests. Each approval or rejection creates a permanent record showing who
reviewed, when, and why (for rejections).

## New Tables

### verification_audit_logs
- `id` (uuid, PK)
- `verification_request_id` (uuid, FK to student_verifications, cascade delete)
- `admin_id` (uuid, FK to profiles, set null on delete)
- `action` (text: 'approved' or 'rejected')
- `rejection_reason` (text, nullable — only for rejections)
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on verification_audit_logs.
- Admins and super_admins can read all audit logs.
- No one can INSERT/UPDATE/DELETE directly — only the SECURITY DEFINER function
  approve_student_verification writes audit records internally.
- Regular users cannot read audit logs.

## Modified Functions
### approve_student_verification
- Updated to INSERT a record into verification_audit_logs after each
  approval or rejection, recording the admin's ID, action, and rejection reason.

## Important Notes
1. The audit log is written inside the SECURITY DEFINER function, so it runs
   with elevated privileges — the caller does not need INSERT access on the
   audit table.
2. The function still enforces admin-only access before making any changes.
3. The audit log is append-only by design — no UPDATE or DELETE policies exist.
*/

CREATE TABLE IF NOT EXISTS verification_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_request_id uuid NOT NULL REFERENCES student_verifications(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE verification_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all audit logs
DROP POLICY IF EXISTS "val_select_admin" ON verification_audit_logs;
CREATE POLICY "val_select_admin" ON verification_audit_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin'))
  );

-- No INSERT/UPDATE/DELETE policies — only the SECURITY DEFINER function writes records

CREATE INDEX IF NOT EXISTS idx_val_verification ON verification_audit_logs(verification_request_id);
CREATE INDEX IF NOT EXISTS idx_val_admin ON verification_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_val_created ON verification_audit_logs(created_at);

-- ============================================================
-- Update the approve function to write audit records
-- ============================================================
CREATE OR REPLACE FUNCTION approve_student_verification(
  p_verification_id uuid,
  p_approve boolean,
  p_rejection_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_role user_role;
BEGIN
  -- Check caller is admin or super_admin
  SELECT role INTO v_role FROM user_roles WHERE user_id = auth.uid();
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  -- Get the verification record
  SELECT user_id INTO v_user_id FROM student_verifications WHERE id = p_verification_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Verification request not found';
  END IF;

  IF p_approve THEN
    UPDATE student_verifications
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    WHERE id = p_verification_id;

    UPDATE profiles SET verification_status = 'verified', updated_at = now()
    WHERE id = v_user_id;

    INSERT INTO verification_audit_logs (verification_request_id, admin_id, action)
    VALUES (p_verification_id, auth.uid(), 'approved');
  ELSE
    UPDATE student_verifications
    SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
        rejection_reason = p_rejection_reason, updated_at = now()
    WHERE id = p_verification_id;

    UPDATE profiles SET verification_status = 'rejected', updated_at = now()
    WHERE id = v_user_id;

    INSERT INTO verification_audit_logs (verification_request_id, admin_id, action, rejection_reason)
    VALUES (p_verification_id, auth.uid(), 'rejected', p_rejection_reason);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_student_verification(uuid, boolean, text) TO authenticated;
