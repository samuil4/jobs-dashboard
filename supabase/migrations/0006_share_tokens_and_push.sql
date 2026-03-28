-- share_tokens: short-lived tokens for share view polling after password unlock
CREATE TABLE IF NOT EXISTS public.share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, token)
);

CREATE INDEX IF NOT EXISTS idx_share_tokens_job_token ON public.share_tokens(job_id, token);
CREATE INDEX IF NOT EXISTS idx_share_tokens_expires_at ON public.share_tokens(expires_at);

COMMENT ON TABLE public.share_tokens IS 'Short-lived tokens for share view polling; issued after password verification.';

ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

-- No RLS policies: table is accessed only by Edge Functions with service role

-- share_push_subscriptions: Web Push subscriptions per job (share view, no auth)
CREATE TABLE IF NOT EXISTS public.share_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_push_subscriptions_job_id ON public.share_push_subscriptions(job_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_share_push_subscriptions_job_endpoint
  ON public.share_push_subscriptions (job_id, ((subscription->>'endpoint')));

COMMENT ON TABLE public.share_push_subscriptions IS 'Web Push subscriptions for share view notifications (job-scoped, no user auth).';
COMMENT ON COLUMN public.share_push_subscriptions.subscription IS 'PushSubscription.toJSON() result: endpoint, keys (p256dh, auth), etc.';

ALTER TABLE public.share_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- No RLS policies: table is accessed only by Edge Functions with service role
-- Grant service role full access; anon/authenticated have no access
