/**
 * client.ts — Adaptador de compatibilidade Supabase → MySQL API
 *
 * Este arquivo re-exporta o apiClient com o nome `supabase` para que
 * todos os arquivos existentes que fazem:
 *   import { supabase } from '@/integrations/supabase/client'
 * continuem funcionando sem alteração.
 *
 * O apiClient conecta ao backend Node.js/Express em vez do Supabase.
 */

import { api } from '@/lib/apiClient';

// Re-export com o nome histórico — mantém compatibilidade com ~200 arquivos
export const supabase = api;

// Export também como default e api para novos arquivos
export { api };
export default api;
