-- E2E Encryption: store each user's ECDH public key (JWK format)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS public_key TEXT;
