-- Add status column to profiles table for soft delete
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add check constraint for status values
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_status_check 
CHECK (status IN ('active', 'inactive'));

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- Add password_change_required column for password management
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS password_change_required boolean NOT NULL DEFAULT false;