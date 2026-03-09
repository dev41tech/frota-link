import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PasswordChangeState {
  requiresChange: boolean;
  isChecking: boolean;
}

export function usePasswordChangeRequired() {
  const { user } = useAuth();
  const [state, setState] = useState<PasswordChangeState>({
    requiresChange: false,
    isChecking: true
  });

  useEffect(() => {
    if (!user) {
      setState({ requiresChange: false, isChecking: false });
      return;
    }

    checkPasswordChangeRequired();
  }, [user?.id]);

  const checkPasswordChangeRequired = async () => {
    if (!user?.id) {
      setState({ requiresChange: false, isChecking: false });
      return;
    }

    try {
      console.log('Verificando password_change_required para user:', user.id);
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('password_change_required')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao verificar password_change_required:', error);
        setState({ requiresChange: false, isChecking: false });
        return;
      }

      const requiresChange = profile?.password_change_required === true;
      console.log('password_change_required:', requiresChange);
      
      setState({
        requiresChange,
        isChecking: false
      });
    } catch (error) {
      console.error('Error checking password change requirement:', error);
      setState({
        requiresChange: false,
        isChecking: false
      });
    }
  };

  const markPasswordChanged = async () => {
    if (!user?.id) {
      throw new Error('Usuário não autenticado');
    }

    try {
      console.log('Marcando password_change_required como false para user:', user.id);
      
      // Atualizar na tabela profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ password_change_required: false })
        .eq('user_id', user.id);

      if (profileError) {
        console.error('Erro ao atualizar profiles:', profileError);
        throw profileError;
      }

      // Também atualizar user_metadata para consistência
      const { error: authError } = await supabase.auth.updateUser({
        data: { requires_password_change: false }
      });

      if (authError) {
        console.warn('Aviso ao atualizar user_metadata:', authError);
        // Não falhar se user_metadata não atualizar
      }

      console.log('password_change_required atualizado com sucesso');
      
      setState(prev => ({
        ...prev,
        requiresChange: false
      }));
    } catch (error) {
      console.error('Error updating password change flag:', error);
      throw error;
    }
  };

  return {
    requiresChange: state.requiresChange,
    isChecking: state.isChecking,
    markPasswordChanged
  };
}
