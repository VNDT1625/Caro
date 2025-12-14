-- Migration: Create Report Actions Table
-- Description: Tạo bảng report_actions cho audit log
-- Date: 2024-12-02

-- Create report_actions table (audit log)
CREATE TABLE IF NOT EXISTS public.report_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  
  -- Action details
  action varchar(50) NOT NULL,
  old_status varchar(20),
  new_status varchar(20),
  notes text,
  metadata jsonb,
  
  -- Timestamp (immutable - no updated_at)
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT check_action_not_empty CHECK (length(trim(action)) > 0),
  CONSTRAINT check_notes_length CHECK (length(notes) <= 2000)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_report_actions_report ON public.report_actions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_actions_admin ON public.report_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_report_actions_created ON public.report_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_actions_action ON public.report_actions(action);

-- Enable Row Level Security
ALTER TABLE public.report_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1) Admins can view all actions
DROP POLICY IF EXISTS report_actions_select_admin ON public.report_actions;
CREATE POLICY report_actions_select_admin ON public.report_actions
  FOR SELECT 
  USING (public.is_admin(auth.uid()));

-- 2) Admins can insert actions
DROP POLICY IF EXISTS report_actions_insert_admin ON public.report_actions;
CREATE POLICY report_actions_insert_admin ON public.report_actions
  FOR INSERT 
  WITH CHECK (public.is_admin(auth.uid()));

-- 3) No UPDATE or DELETE - audit log is immutable
-- Only service_role can modify if absolutely necessary

-- Create helper function to log report actions
CREATE OR REPLACE FUNCTION public.log_report_action(
  p_report_id uuid,
  p_admin_id uuid,
  p_action varchar,
  p_old_status varchar DEFAULT NULL,
  p_new_status varchar DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_id uuid;
BEGIN
  INSERT INTO public.report_actions (
    report_id,
    admin_id,
    action,
    old_status,
    new_status,
    notes,
    metadata
  ) VALUES (
    p_report_id,
    p_admin_id,
    p_action,
    p_old_status,
    p_new_status,
    p_notes,
    p_metadata
  )
  RETURNING id INTO v_action_id;
  
  RETURN v_action_id;
END;
$$;

-- Grant execute permission on function
GRANT EXECUTE ON FUNCTION public.log_report_action(uuid, uuid, varchar, varchar, varchar, text, jsonb) TO authenticated;

-- Create trigger to auto-log report status changes
CREATE OR REPLACE FUNCTION public.auto_log_report_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.report_actions (
      report_id,
      admin_id,
      action,
      old_status,
      new_status,
      notes
    ) VALUES (
      NEW.id,
      NEW.processed_by,
      'status_change',
      OLD.status::varchar,
      NEW.status::varchar,
      'Auto-logged status change'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on reports table
DROP TRIGGER IF EXISTS trigger_auto_log_report_status ON public.reports;
CREATE TRIGGER trigger_auto_log_report_status
  AFTER UPDATE ON public.reports
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.auto_log_report_status_change();

-- Comments for documentation
COMMENT ON TABLE public.report_actions IS 'Audit log cho tất cả actions trên reports (immutable)';
COMMENT ON COLUMN public.report_actions.action IS 'Loại action: status_change, ban_applied, appeal_processed, etc.';
COMMENT ON COLUMN public.report_actions.metadata IS 'Dữ liệu bổ sung dạng JSON';
COMMENT ON FUNCTION public.log_report_action IS 'Helper function để log actions vào audit trail';

-- Grant permissions
GRANT SELECT ON public.report_actions TO authenticated;
GRANT ALL ON public.report_actions TO service_role;
