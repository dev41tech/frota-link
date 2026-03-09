import { supabase } from '@/integrations/supabase/client';

export function generateSecurePassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  // Ensure at least one character from each category
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill remaining characters (minimum 10 total)
  const allChars = uppercase + lowercase + numbers + symbols;
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

export async function createUserWithEmailNotification({
  email,
  full_name,
  company_id,
  role,
  phone = '',
  created_by_name,
  temporary_password
}: {
  email: string;
  full_name: string;
  company_id?: string;
  role: 'master' | 'admin' | 'gestor' | 'motorista' | 'driver';
  phone?: string;
  created_by_name: string;
  temporary_password?: string;
}): Promise<{ success: boolean; error?: string; user_id?: string; temporary_password?: string }> {
  try {
    // Call the create-user Edge Function which has service role privileges
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email,
        full_name,
        company_id,
        role,
        phone,
        created_by_name,
        temporary_password,
        login_url: `${window.location.origin}/auth`
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      return { success: false, error: error.message };
    }

    return data;

  } catch (error: any) {
    console.error('User creation error:', error);
    return { 
      success: false, 
      error: error.message || 'Erro interno do servidor' 
    };
  }
}