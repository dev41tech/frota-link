import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client with service role key for admin operations
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

function generateSecurePassword(): string {
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
  
  // Fill remaining characters (minimum 12 total)
  const allChars = uppercase + lowercase + numbers + symbols;
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract JWT token from authorization header
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the user making the request using the extracted token
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);

    if (userError || !user) {
      console.error('User verification error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, full_name, company_id, role, phone = '', created_by_name, login_url, temporary_password } = await req.json();

    // Verify permissions: admins, masters, and gestors (for drivers only) can create users
    const { data: requestingUserRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role, company_id')
      .eq('user_id', user.id);

    const isMaster = requestingUserRoles?.some(r => r.role === 'master');
    const isAdminOfCompany = requestingUserRoles?.some(r => r.role === 'admin' && r.company_id === company_id);
    const isGestorOfCompany = requestingUserRoles?.some(r => r.role === 'gestor' && r.company_id === company_id);

    // Gestores can only create driver users
    const gestorAllowed = isGestorOfCompany && (role === 'driver' || role === 'motorista');

    if (!isMaster && !isAdminOfCompany && !gestorAllowed) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions to create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only master users can create master users
    if (role === 'master' && !isMaster) {
      return new Response(
        JSON.stringify({ error: 'Only master users can create master users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating user with data:', {
      email,
      full_name,
      company_id: company_id || 'NULL (master)',
      role,
      phone: phone || 'not provided',
    });

    // Check if user already exists in auth
    const { data: existingAuthUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingAuthUser.users.some(u => u.email === email);
    
    if (userExists) {
      return new Response(
        JSON.stringify({ error: 'User with this email already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if profile already exists
    const { data: existingProfileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfileByEmail) {
      return new Response(
        JSON.stringify({ error: 'Profile with this email already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use provided password or generate secure temporary password
    const finalPassword = temporary_password || generateSecurePassword();
    
    // Create user in Supabase Auth using admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: finalPassword,
      user_metadata: {
        full_name,
        company_id,
        role,
        phone,
        requires_password_change: true,
        created_by: created_by_name
      },
      email_confirm: true
    });

    console.log(`Auth user created with ID: ${authData?.user?.id}`);

    if (authError) {
      console.error('Auth creation error:', authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Checking if profile was created by trigger...');

    // Wait a moment for trigger to execute
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if profile exists (created by trigger)
    const { data: existingProfileByUser } = await supabaseAdmin
      .from('profiles')
      .select('id, role, company_id')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (!existingProfileByUser) {
      console.log('Profile not created by trigger, creating manually...');
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          full_name,
          email,
          phone,
          role,
          company_id: ['master', 'bpo', 'suporte'].includes(role) ? null : company_id,
          password_change_required: true
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Clean up auth user if profile creation fails
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          console.log('Cleaned up auth user after profile creation failure');
        } catch (cleanupError) {
          console.error('Failed to cleanup auth user:', cleanupError);
        }
        return new Response(
          JSON.stringify({ error: `Profile creation failed: ${profileError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Profile created manually');
    } else {
      console.log(`Profile already exists (created by trigger): role=${existingProfileByUser.role}, company_id=${existingProfileByUser.company_id}`);
    }

    // Check if user role already exists (to avoid duplicates)
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', authData.user.id)
      .eq('role', role)
      .maybeSingle();

    if (!existingRole) {
      console.log(`Creating user_role entry for role ${role}...`);
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          company_id: ['master', 'bpo', 'suporte'].includes(role) ? null : company_id,
          role
        });

      if (roleError) {
        console.error('User role creation error:', roleError);
        // Clean up on error
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return new Response(
          JSON.stringify({ error: `Role creation failed: ${roleError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('User role created successfully');
    } else {
      console.log('User role already exists');
    }

    // Get company information for email (only if not master)
    let companyData = null;
    if (!['master', 'bpo', 'suporte'].includes(role) && company_id) {
      const result = await supabaseAdmin
        .from('companies')
        .select('name')
        .eq('id', company_id)
        .maybeSingle();
      companyData = result.data;
    }

    // Send credentials email
    console.log(`Sending credentials email to ${email}...`);
    const appLoginUrl = login_url || `https://seu-app.lovable.app/auth`;
    
    try {
      const { data: emailData, error: emailError } = await supabaseAdmin.functions.invoke('send-credentials', {
        body: {
          email,
          full_name,
          company_name: companyData?.name || 'Empresa',
          temporary_password: finalPassword,
          login_url: appLoginUrl,
          created_by: created_by_name
        }
      });

      if (emailError) {
        console.error('Email sending error:', emailError);
        console.warn('User created but email notification failed');
      } else {
        console.log('Credentials email sent successfully:', emailData);
      }
    } catch (emailErr: any) {
      console.error('Exception sending email:', emailErr.message);
      console.warn('User created but email notification failed');
    }

    // Log audit trail
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: authData.user.id,
        company_id,
        action: 'CREATE_USER',
        table_name: 'profiles',
        record_id: authData.user.id,
        new_values: {
          email,
          full_name,
          role,
          company_id,
          created_by: created_by_name
        }
      });

    console.log('User creation completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: authData.user.id,
        temporary_password: finalPassword
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('User creation error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);