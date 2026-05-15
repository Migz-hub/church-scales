
-- 1. user_roles: prevent self-granting 'member' without being a ministry member
DROP POLICY IF EXISTS roles_insert_admins_or_self_initial ON public.user_roles;
CREATE POLICY roles_insert_admins_or_self_initial ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    has_any_role(auth.uid(), ministry_id, ARRAY['owner'::app_role, 'admin'::app_role])
    OR (
      user_id = auth.uid()
      AND role = 'owner'::app_role
      AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.ministry_id = user_roles.ministry_id)
    )
    OR (
      user_id = auth.uid()
      AND role = 'member'::app_role
      AND is_member_of(auth.uid(), ministry_id)
    )
  );

-- 2. notifications: restrict insert target user
DROP POLICY IF EXISTS notifications_insert_member ON public.notifications;
CREATE POLICY notifications_insert_member ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR (ministry_id IS NOT NULL AND has_any_role(auth.uid(), ministry_id, ARRAY['owner'::app_role, 'admin'::app_role, 'leader'::app_role]))
  );

-- 3. schedule_assignments: restrict self-update to status only (no reassignment, no attendance, no schedule/label changes)
DROP POLICY IF EXISTS assignments_update_self ON public.schedule_assignments;
CREATE POLICY assignments_update_self ON public.schedule_assignments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND schedule_id = (SELECT schedule_id FROM public.schedule_assignments sa WHERE sa.id = schedule_assignments.id)
    AND label = (SELECT label FROM public.schedule_assignments sa WHERE sa.id = schedule_assignments.id)
    AND attended IS NOT DISTINCT FROM (SELECT attended FROM public.schedule_assignments sa WHERE sa.id = schedule_assignments.id)
  );

-- 4. schedule_history: validate schedule belongs to ministry
DROP POLICY IF EXISTS history_insert_members ON public.schedule_history;
CREATE POLICY history_insert_members ON public.schedule_history
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND is_member_of(auth.uid(), ministry_id)
    AND EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = schedule_history.schedule_id
        AND s.ministry_id = schedule_history.ministry_id
    )
  );
