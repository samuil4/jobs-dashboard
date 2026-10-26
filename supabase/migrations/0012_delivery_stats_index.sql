-- Speeds up the staff statistics page, which scans delivery history by type and date.
CREATE INDEX IF NOT EXISTS job_updates_delivery_created_at_idx
  ON public.job_updates (created_at)
  WHERE update_type = 'delivery';

COMMENT ON INDEX public.job_updates_delivery_created_at_idx IS
  'Supports delivery statistics date-range scans.';
