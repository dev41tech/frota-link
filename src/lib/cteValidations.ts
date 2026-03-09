import { supabase } from '@/integrations/supabase/client';

export interface CTeValidationResult {
  valid: boolean;
  errors: string[];
  certificate?: any;
  settings?: any;
}

/**
 * Validates all CT-e requirements before emission
 */
export async function validateCTeRequirements(
  companyId: string
): Promise<CTeValidationResult> {
  const errors: string[] = [];

  try {
    // 1. Check for valid digital certificate
    const { data: certificate, error: certError } = await supabase
      .from('digital_certificates')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (certError) {
      errors.push(`Erro ao verificar certificado: ${certError.message}`);
    }

    if (!certificate) {
      errors.push('Certificado digital não encontrado ou expirado. Configure em CT-e > Certificados.');
    }

    // 2. Check for CT-e settings
    const { data: settings, error: settingsError } = await supabase
      .from('cte_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (settingsError) {
      errors.push(`Erro ao verificar configurações: ${settingsError.message}`);
    }

    if (!settings) {
      errors.push('Configurações de CT-e não encontradas. Configure em CT-e > Configurações.');
    }

    if (settings && !settings.nuvem_fiscal_company_id) {
      errors.push('Empresa na Nuvem Fiscal não configurada.');
    }

    return {
      valid: errors.length === 0,
      errors,
      certificate: certificate || undefined,
      settings: settings || undefined,
    };
  } catch (error: any) {
    return {
      valid: false,
      errors: [`Erro inesperado: ${error.message}`],
    };
  }
}

/**
 * Checks if a journey already has a CT-e emitted
 */
export async function checkExistingCTe(journeyId: string) {
  const { data, error } = await supabase
    .from('cte_documents')
    .select('id, cte_number, cte_key, status')
    .eq('journey_id', journeyId)
    .maybeSingle();

  if (error) {
    console.error('Error checking existing CT-e:', error);
    return null;
  }

  return data;
}
