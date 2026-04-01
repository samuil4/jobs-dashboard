ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

ALTER TABLE public.jobs
ADD CONSTRAINT jobs_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

COMMENT ON COLUMN public.jobs.priority IS 'Job priority level: low, normal, high, or urgent.';
