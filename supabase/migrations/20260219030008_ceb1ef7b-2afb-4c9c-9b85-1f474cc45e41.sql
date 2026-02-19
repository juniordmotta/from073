
-- Add expires_at column to profiles (nullable - no expiration by default)
ALTER TABLE public.profiles ADD COLUMN expires_at timestamp with time zone DEFAULT NULL;
