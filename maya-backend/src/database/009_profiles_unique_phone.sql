-- Migration: 009_profiles_unique_phone.sql
-- Description: Strictly enforce that only 1 user account can have a given phone number.
-- Prevents duplicate accounts or account hijacking via identical phone numbers.

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_number_unique
ON public.profiles (phone_number)
WHERE phone_number IS NOT NULL AND phone_number != '';

COMMENT ON INDEX idx_profiles_phone_number_unique IS
'Guarantees at database-level that each phone number belongs to exactly one user account.';
