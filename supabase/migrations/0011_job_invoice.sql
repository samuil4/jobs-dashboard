ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS invoice text NULL;

COMMENT ON COLUMN public.jobs.invoice IS 'Optional invoice reference; shown in client portal when set.';
