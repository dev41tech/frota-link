import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the JWT from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Verify the JWT and get the requesting user
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
    
    if (authError || !requestingUser) {
      throw new Error("Invalid authentication token");
    }

    console.log(`Password reset requested by user: ${requestingUser.id}`);

    // Parse request body
    const { user_id, email, new_password } = await req.json();

    if (!user_id || !email || !new_password) {
      throw new Error("Missing required fields: user_id, email, and new_password");
    }

    console.log(`Resetting password for user: ${user_id} (${email})`);

    // Get requesting user's role(s) - handle multiple roles
    const { data: requestingUserRoles, error: profileError } = await supabaseAdmin
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", requestingUser.id);

    if (profileError || !requestingUserRoles || requestingUserRoles.length === 0) {
      throw new Error("Could not find requesting user profile");
    }

    // Get target user's role(s)
    const { data: targetUserRoles, error: targetProfileError } = await supabaseAdmin
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", user_id);

    if (targetProfileError || !targetUserRoles || targetUserRoles.length === 0) {
      throw new Error("Could not find target user profile");
    }

    // Check permissions - handle multiple roles
    const isMaster = requestingUserRoles.some(r => r.role === "master");
    const targetCompanyId = targetUserRoles.find(r => r.company_id)?.company_id;
    const isAdminOfSameCompany = targetCompanyId && requestingUserRoles.some(
      r => r.role === "admin" && r.company_id === targetCompanyId
    );

    if (!isMaster && !isAdminOfSameCompany) {
      throw new Error("Insufficient permissions to reset password");
    }

    console.log(`User ${requestingUser.id} (master: ${isMaster}, admin: ${isAdminOfSameCompany}) resetting password for user ${user_id}`);

    console.log(`Permission check passed. Updating password in Supabase Auth...`);

    // Update user password in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      {
        password: new_password,
        user_metadata: {
          requires_password_change: true
        }
      }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      throw updateError;
    }

    console.log(`Password updated successfully. Sending credentials email...`);

    // Get company name for email
    const { data: companyData } = await supabaseAdmin
      .from("companies")
      .select("name")
      .eq("id", targetCompanyId || "")
      .maybeSingle();

    const companyName = companyData?.name || "Sistema";

    // Get target user's full name
    const { data: userData } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", user_id)
      .single();

    const fullName = userData?.full_name || "Usuário";

    // Get requesting user's name for the email
    const { data: requestingUserData } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", requestingUser.id)
      .single();

    const createdBy = requestingUserData?.full_name || "Administrador";

    // Send credentials email
    const loginUrl = `${Deno.env.get("SUPABASE_URL").replace("https://", "https://")}/auth/v1/verify`;
    
    try {
      await supabaseAdmin.functions.invoke("send-credentials", {
        body: {
          email,
          full_name: fullName,
          company_name: companyName,
          temporary_password: new_password,
          login_url: loginUrl,
          created_by: `${createdBy} (redefinição de senha)`
        }
      });
      console.log("Credentials email sent successfully");
    } catch (emailError) {
      console.error("Failed to send credentials email:", emailError);
      // Don't fail the whole operation if email fails
    }

    // Log the password reset in audit_logs
    await supabaseAdmin.from("audit_logs").insert({
      user_id: requestingUser.id,
      company_id: targetCompanyId,
      action: "password_reset",
      table_name: "profiles",
      record_id: user_id,
      old_values: { email },
      new_values: { 
        email, 
        password_reset_by: requestingUser.id,
        requires_password_change: true
      }
    });

    console.log(`Password reset completed successfully for ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Password reset successfully",
        temporary_password: new_password
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in reset-user-password function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
