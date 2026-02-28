-- Add share_password_hash column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS share_password_hash text;

-- Enable pgcrypto extension for bcrypt (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- RPC: Verify job share password and return job data if valid
-- Stored hashes are bcrypt $2b$ (from frontend bcryptjs). Uses extensions.crypt for verification.
-- Returns: { valid: boolean, job?: { id, name, parts_needed, parts_produced, parts_overproduced, delivered } }
CREATE OR REPLACE FUNCTION public.verify_job_share_password(p_job_id uuid, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hash text;
  v_result jsonb;
BEGIN
  SELECT share_password_hash INTO v_hash FROM jobs WHERE id = p_job_id;
  IF v_hash IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'no_share_password');
  END IF;
  IF extensions.crypt(p_password, v_hash) != v_hash THEN
    RETURN jsonb_build_object('valid', false);
  END IF;
  SELECT jsonb_build_object(
    'valid', true,
    'job', jsonb_build_object(
      'id', id,
      'name', name,
      'parts_needed', parts_needed,
      'parts_produced', parts_produced,
      'parts_overproduced', COALESCE(parts_overproduced, 0),
      'delivered', COALESCE(delivered, 0)
    )
  ) INTO v_result
  FROM jobs WHERE id = p_job_id;
  RETURN v_result;
END;
$function$;

-- Allow anon and authenticated to call the function (anon for share view access)
GRANT EXECUTE ON FUNCTION public.verify_job_share_password(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_job_share_password(uuid, text) TO authenticated;
