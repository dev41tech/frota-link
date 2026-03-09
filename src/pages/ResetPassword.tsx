import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  Truck, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  ArrowRight,
  RefreshCw,
  XCircle
} from 'lucide-react';

type LinkStatus = 'validating' | 'valid' | 'expired' | 'error';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Link validation states
  const [linkStatus, setLinkStatus] = useState<LinkStatus>('validating');
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Validate link on mount - handle PKCE flow and errors
  useEffect(() => {
    const validateLink = async () => {
      // Check for error in URL (Supabase redirects with error params)
      const errorCode = searchParams.get('error_code');
      const errorDescription = searchParams.get('error_description');
      const error = searchParams.get('error');
      
      if (errorCode || error) {
        console.log('Reset password error from URL:', { errorCode, error, errorDescription });
        
        if (errorCode === 'otp_expired' || errorDescription?.includes('expired')) {
          setLinkStatus('expired');
          setLinkError('O link de recuperação expirou. Por favor, solicite um novo e-mail.');
        } else if (errorCode === 'access_denied' || error === 'access_denied') {
          setLinkStatus('error');
          setLinkError('Acesso negado. Por favor, solicite um novo link de recuperação.');
        } else {
          setLinkStatus('error');
          setLinkError(errorDescription || 'Erro ao validar o link. Por favor, solicite um novo.');
        }
        return;
      }

      // Check for PKCE code flow
      const code = searchParams.get('code');
      
      if (code) {
        try {
          console.log('PKCE code found, exchanging for session...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('Error exchanging code for session:', error);
            if (error.message?.includes('expired') || error.message?.includes('invalid')) {
              setLinkStatus('expired');
              setLinkError('O link de recuperação expirou ou é inválido. Por favor, solicite um novo e-mail.');
            } else {
              setLinkStatus('error');
              setLinkError('Erro ao processar o link. Por favor, solicite um novo.');
            }
            return;
          }
          
          if (data.session) {
            console.log('Session established successfully via PKCE');
            setLinkStatus('valid');
            return;
          }
        } catch (err) {
          console.error('Exception during code exchange:', err);
          setLinkStatus('error');
          setLinkError('Erro ao processar o link. Por favor, solicite um novo.');
          return;
        }
      }

      // Fallback: Check if there's already a valid session (for implicit flow)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          console.log('Existing session found');
          setLinkStatus('valid');
        } else {
          // No session and no code - user probably navigated here directly
          console.log('No session or code found');
          setLinkStatus('error');
          setLinkError('Link inválido ou expirado. Por favor, solicite um novo e-mail de recuperação.');
        }
      } catch (err) {
        console.error('Error checking session:', err);
        setLinkStatus('error');
        setLinkError('Erro ao verificar sessão. Por favor, tente novamente.');
      }
    };

    validateLink();
  }, [searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        console.error('Error updating password:', error);
        if (error.message?.includes('same password')) {
          setError('A nova senha deve ser diferente da anterior.');
        } else {
          setError('Erro ao atualizar senha. Tente novamente.');
        }
      } else {
        setSuccess(true);
        toast({
          title: "Senha alterada!",
          description: "Sua senha foi atualizada com sucesso."
        });
        
        // Sign out to clear recovery session and redirect to login
        setTimeout(async () => {
          await supabase.auth.signOut();
          navigate('/auth', { replace: true });
        }, 2000);
      }
    } catch (err) {
      console.error('Exception updating password:', err);
      setError('Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNewLink = () => {
    navigate('/auth', { replace: true });
  };

  const isPasswordFilled = password.length > 0;
  const isConfirmFilled = confirmPassword.length > 0;

  // Render validation state
  const renderValidationState = () => {
    if (linkStatus === 'validating') {
      return (
        <div className="text-center py-10">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary mb-4" />
          <h3 className="text-xl font-bold text-foreground mb-2">Verificando link...</h3>
          <p className="text-muted-foreground text-sm">
            Aguarde enquanto validamos seu link de recuperação.
          </p>
        </div>
      );
    }

    if (linkStatus === 'expired') {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Link Expirado</h3>
          <p className="text-muted-foreground text-sm mb-6">
            {linkError}
          </p>
          <button
            onClick={handleRequestNewLink}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-4 rounded-xl shadow-lg hover:shadow-primary/30 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3"
          >
            <span>Solicitar Novo Link</span>
            <ArrowRight className="h-5 w-5" />
          </button>
          <button
            onClick={handleRequestNewLink}
            className="mt-4 text-primary text-sm font-medium hover:underline"
          >
            Voltar para o login
          </button>
        </div>
      );
    }

    if (linkStatus === 'error') {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Link Inválido</h3>
          <p className="text-muted-foreground text-sm mb-6">
            {linkError}
          </p>
          <button
            onClick={handleRequestNewLink}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-4 rounded-xl shadow-lg hover:shadow-primary/30 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3"
          >
            <span>Solicitar Novo Link</span>
            <ArrowRight className="h-5 w-5" />
          </button>
          <button
            onClick={handleRequestNewLink}
            className="mt-4 text-primary text-sm font-medium hover:underline"
          >
            Voltar para o login
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-secondary">
      {/* Background Premium */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary to-secondary" />
      
      {/* Animated Orbs */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-primary/30 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Main Container */}
      <div 
        className={`
          relative z-10 w-full max-w-md mx-4 
          bg-card/5 backdrop-blur-xl border border-border/20 
          rounded-2xl shadow-2xl overflow-hidden
          transition-all duration-700 ease-out transform
          ${mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
        `}
      >
        <div className="bg-card p-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="p-2 bg-primary rounded-xl">
              <Truck className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Frota Link</span>
          </div>

          {/* Show validation state if not valid yet */}
          {linkStatus !== 'valid' && renderValidationState()}

          {/* Success State */}
          {linkStatus === 'valid' && success && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Senha alterada!</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Redirecionando para o login...
              </p>
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
            </div>
          )}

          {/* Password Form - Only show when link is valid and not success */}
          {linkStatus === 'valid' && !success && (
            <>
              {/* Header */}
              <div className="mb-6 text-center">
                <h3 className="text-2xl font-bold text-foreground mb-2">Nova Senha</h3>
                <p className="text-muted-foreground text-sm">Digite sua nova senha para continuar</p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  <span className="text-sm text-destructive font-medium">{error}</span>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-5">
                {/* Password Field */}
                <div className="relative">
                  <div className={`
                    absolute left-4 top-1/2 -translate-y-1/2 
                    transition-colors duration-200
                    ${isPasswordFilled ? 'text-primary' : 'text-muted-foreground'}
                  `}>
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="Nova senha"
                    className={`
                      w-full pl-12 pr-12 py-4 
                      bg-muted/50 border-2 rounded-xl
                      text-foreground font-medium
                      transition-all duration-200
                      focus:outline-none focus:bg-card focus:border-primary
                      ${isPasswordFilled ? 'bg-card border-primary/30' : 'border-transparent'}
                    `}
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                {/* Confirm Password Field */}
                <div className="relative">
                  <div className={`
                    absolute left-4 top-1/2 -translate-y-1/2 
                    transition-colors duration-200
                    ${isConfirmFilled ? 'text-primary' : 'text-muted-foreground'}
                  `}>
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="Confirmar nova senha"
                    className={`
                      w-full pl-12 pr-12 py-4 
                      bg-muted/50 border-2 rounded-xl
                      text-foreground font-medium
                      transition-all duration-200
                      focus:outline-none focus:bg-card focus:border-primary
                      ${isConfirmFilled ? 'bg-card border-primary/30' : 'border-transparent'}
                    `}
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                {/* Password Requirements */}
                <p className="text-muted-foreground text-xs">
                  A senha deve ter pelo menos 6 caracteres
                </p>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`
                    w-full bg-primary hover:bg-primary/90 text-primary-foreground 
                    font-bold py-4 rounded-xl shadow-lg 
                    hover:shadow-primary/30 active:scale-[0.98] 
                    transition-all duration-200 
                    flex items-center justify-center gap-3 
                    disabled:opacity-70 disabled:cursor-not-allowed 
                    group relative overflow-hidden
                  `}
                >
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <span>Alterar Senha</span>
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              {/* Back to Login */}
              <div className="mt-6 text-center">
                <button
                  onClick={() => navigate('/auth')}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  Voltar para o login
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Copyright */}
      <div className="absolute bottom-4 text-muted-foreground/50 text-xs font-medium">
        © 2025 Frota Link Technology
      </div>
    </div>
  );
}