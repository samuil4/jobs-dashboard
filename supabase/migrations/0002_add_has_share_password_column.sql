-- Add generated column has_share_password so client APIs never need to expose share_password_hash
-- The hash stays server-side; clients only see a boolean flag.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS has_share_password boolean GENERATED ALWAYS AS (share_password_hash IS NOT NULL) STORED;
