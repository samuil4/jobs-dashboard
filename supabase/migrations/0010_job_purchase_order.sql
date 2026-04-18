ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS purchase_order text NULL;

COMMENT ON COLUMN public.jobs.purchase_order IS 'Optional purchase order reference for staff and client display.';