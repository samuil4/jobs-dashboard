CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  company_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clients IS 'External client accounts linked to Supabase auth users.';
COMMENT ON COLUMN public.clients.username IS 'Client-facing username used for sign in.';
COMMENT ON COLUMN public.clients.company_name IS 'Display name for the client company.';

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_auth_user_id ON public.clients(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_username ON public.clients(username);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON public.jobs(client_id);

CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.clients c
  WHERE c.auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_client_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_client_id() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND public.current_client_id() IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.current_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_client_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_user() TO authenticated;

DROP POLICY IF EXISTS "jobs are readable by authenticated users" ON public.jobs;
DROP POLICY IF EXISTS "jobs are writable by authenticated users" ON public.jobs;
DROP POLICY IF EXISTS "job updates are readable by authenticated users" ON public.job_updates;
DROP POLICY IF EXISTS "job updates are writable by authenticated users" ON public.job_updates;

DROP POLICY IF EXISTS clients_select_staff ON public.clients;
DROP POLICY IF EXISTS clients_select_self ON public.clients;
DROP POLICY IF EXISTS clients_insert_staff ON public.clients;
DROP POLICY IF EXISTS clients_update_staff ON public.clients;
DROP POLICY IF EXISTS clients_delete_staff ON public.clients;

CREATE POLICY clients_select_staff
  ON public.clients FOR SELECT
  USING (public.is_staff_user());

CREATE POLICY clients_select_self
  ON public.clients FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY clients_insert_staff
  ON public.clients FOR INSERT
  WITH CHECK (public.is_staff_user());

CREATE POLICY clients_update_staff
  ON public.clients FOR UPDATE
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

CREATE POLICY clients_delete_staff
  ON public.clients FOR DELETE
  USING (public.is_staff_user());

DROP POLICY IF EXISTS jobs_select_staff ON public.jobs;
DROP POLICY IF EXISTS jobs_select_client_assigned ON public.jobs;
DROP POLICY IF EXISTS jobs_insert_staff ON public.jobs;
DROP POLICY IF EXISTS jobs_update_staff ON public.jobs;
DROP POLICY IF EXISTS jobs_delete_staff ON public.jobs;

CREATE POLICY jobs_select_staff
  ON public.jobs FOR SELECT
  USING (public.is_staff_user());

CREATE POLICY jobs_select_client_assigned
  ON public.jobs FOR SELECT
  USING (client_id = public.current_client_id());

CREATE POLICY jobs_insert_staff
  ON public.jobs FOR INSERT
  WITH CHECK (public.is_staff_user());

CREATE POLICY jobs_update_staff
  ON public.jobs FOR UPDATE
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

CREATE POLICY jobs_delete_staff
  ON public.jobs FOR DELETE
  USING (public.is_staff_user());

DROP POLICY IF EXISTS job_updates_select_staff ON public.job_updates;
DROP POLICY IF EXISTS job_updates_select_client_assigned ON public.job_updates;
DROP POLICY IF EXISTS job_updates_insert_staff ON public.job_updates;
DROP POLICY IF EXISTS job_updates_update_staff ON public.job_updates;
DROP POLICY IF EXISTS job_updates_delete_staff ON public.job_updates;

CREATE POLICY job_updates_select_staff
  ON public.job_updates FOR SELECT
  USING (public.is_staff_user());

CREATE POLICY job_updates_select_client_assigned
  ON public.job_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_updates.job_id
        AND j.client_id = public.current_client_id()
    )
  );

CREATE POLICY job_updates_insert_staff
  ON public.job_updates FOR INSERT
  WITH CHECK (public.is_staff_user());

CREATE POLICY job_updates_update_staff
  ON public.job_updates FOR UPDATE
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

CREATE POLICY job_updates_delete_staff
  ON public.job_updates FOR DELETE
  USING (public.is_staff_user());

DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;

CREATE POLICY push_subscriptions_select_own
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id AND public.is_staff_user());

CREATE POLICY push_subscriptions_insert_own
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_staff_user());

CREATE POLICY push_subscriptions_update_own
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id AND public.is_staff_user())
  WITH CHECK (auth.uid() = user_id AND public.is_staff_user());

CREATE POLICY push_subscriptions_delete_own
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id AND public.is_staff_user());

CREATE TABLE IF NOT EXISTS public.client_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_push_subscriptions_client_id
  ON public.client_push_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_push_subscriptions_user_id
  ON public.client_push_subscriptions(user_id);

COMMENT ON TABLE public.client_push_subscriptions IS 'Web Push subscriptions scoped to client portal users.';

ALTER TABLE public.client_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_push_subscriptions_select_own ON public.client_push_subscriptions;
DROP POLICY IF EXISTS client_push_subscriptions_insert_own ON public.client_push_subscriptions;
DROP POLICY IF EXISTS client_push_subscriptions_update_own ON public.client_push_subscriptions;
DROP POLICY IF EXISTS client_push_subscriptions_delete_own ON public.client_push_subscriptions;

CREATE POLICY client_push_subscriptions_select_own
  ON public.client_push_subscriptions FOR SELECT
  USING (auth.uid() = user_id AND client_id = public.current_client_id());

CREATE POLICY client_push_subscriptions_insert_own
  ON public.client_push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND client_id = public.current_client_id());

CREATE POLICY client_push_subscriptions_update_own
  ON public.client_push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id AND client_id = public.current_client_id())
  WITH CHECK (auth.uid() = user_id AND client_id = public.current_client_id());

CREATE POLICY client_push_subscriptions_delete_own
  ON public.client_push_subscriptions FOR DELETE
  USING (auth.uid() = user_id AND client_id = public.current_client_id());
