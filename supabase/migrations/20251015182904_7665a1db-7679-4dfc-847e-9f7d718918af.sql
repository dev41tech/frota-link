-- Fix the handle_new_user function to properly handle master vs non-master roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_role text;
  user_company_id uuid;
  password_required boolean;
BEGIN
  -- Extract metadata from the new user
  user_role := NEW.raw_user_meta_data->>'role';
  user_company_id := (NEW.raw_user_meta_data->>'company_id')::uuid;
  password_required := COALESCE((NEW.raw_user_meta_data->>'requires_password_change')::boolean, true);
  
  -- Log for debugging
  RAISE NOTICE 'Creating profile for user %. Role: %, Company: %', NEW.id, user_role, user_company_id;
  
  -- Only insert profile if we have the necessary data
  -- Master users: company_id must be NULL
  -- Other users: company_id must be provided
  IF user_role = 'master' THEN
    INSERT INTO public.profiles (
      user_id, 
      full_name, 
      email, 
      company_id,
      role,
      password_change_required
    )
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'full_name',
      NEW.email,
      NULL, -- Master users have NULL company_id
      'master'::app_role,
      password_required
    );
    RAISE NOTICE 'Created master profile for user %', NEW.id;
  ELSIF user_role IS NOT NULL AND user_company_id IS NOT NULL THEN
    INSERT INTO public.profiles (
      user_id, 
      full_name, 
      email, 
      company_id,
      role,
      password_change_required,
      phone
    )
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'full_name',
      NEW.email,
      user_company_id,
      user_role::app_role,
      password_required,
      NEW.raw_user_meta_data->>'phone'
    );
    RAISE NOTICE 'Created profile for user % with role % and company %', NEW.id, user_role, user_company_id;
  ELSE
    -- Log but don't fail - let create-user edge function handle profile creation
    RAISE NOTICE 'Skipping automatic profile creation for user % - missing role or company_id', NEW.id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;