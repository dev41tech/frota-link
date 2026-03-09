import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDomainRouting } from '@/hooks/useDomainRouting';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Truck, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export default function Auth() {
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { redirectTo, isLandingDomain } = useDomainRouting();
  
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [shakeFields, setShakeFields] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  // Forgot password state
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // Animation mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load remembered email on mount
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    const wasRemembered = localStorage.getItem('rememberMe') === 'true';
    if (rememberedEmail && wasRemembered) {
      setLoginData(prev => ({ ...prev, email: rememberedEmail }));
      setRememberMe(true);
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      const from = (location.state as any)?.from?.pathname || '/home';
      if (isLandingDomain) {
        redirectTo('client', from);
      } else {
        navigate(from, { replace: true });
      }
    }
  }, [user, navigate, isLandingDomain, redirectTo, location.state]);

  const triggerShake = () => {
    setShakeFields(true);
    setTimeout(() => setShakeFields(false), 500);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!loginData.email || !loginData.password) {
      setError('Preencha todos os campos');
      triggerShake();
      return;
    }

    setLoading(true);
    const { error: authError } = await signIn(loginData.email, loginData.password);

    if (authError) {
      setError(authError.message === 'Invalid login credentials' 
        ? 'Email ou senha incorretos' 
        : authError.message);
      triggerShake();
      setLoading(false);
      return;
    }

    // Save or clear remembered email based on checkbox
    if (rememberMe) {
      localStorage.setItem('rememberedEmail', loginData.email);
      localStorage.setItem('rememberMe', 'true');
    } else {
      localStorage.removeItem('rememberedEmail');
      localStorage.removeItem('rememberMe');
    }

    toast({
      title: "Login realizado!",
      description: "Bem-vindo ao Frota Link!"
    });

    const from = (location.state as any)?.from?.pathname || '/home';
    if (isLandingDomain) {
      redirectTo('client', from);
    } else {
      navigate(from, { replace: true });
    }
    
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);

    if (!forgotEmail || !forgotEmail.includes('@')) {
      setForgotError('Por favor, insira um e-mail válido');
      setForgotLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setForgotError('Erro ao enviar e-mail de recuperação. Tente novamente.');
      } else {
        setForgotSuccess(true);
      }
    } catch (err) {
      setForgotError('Ocorreu um erro. Tente novamente.');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotPasswordModal = () => {
    setForgotPasswordOpen(false);
    setForgotEmail('');
    setForgotError('');
    setForgotSuccess(false);
  };

  const isEmailFilled = loginData.email.length > 0;
  const isPasswordFilled = loginData.password.length > 0;

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-secondary">
      
      {/* Background Premium */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary to-secondary" />
      
      {/* Animated Orbs */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-primary/30 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
      
      {/* Grid Pattern SVG */}
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
          relative z-10 w-full max-w-[1000px] mx-4 
          bg-card/5 backdrop-blur-xl border border-border/20 
          rounded-2xl shadow-2xl flex flex-col lg:flex-row overflow-hidden
          transition-all duration-700 ease-out transform
          ${mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
        `}
      >
        
        {/* Left Panel - Branding (Hidden on mobile) */}
        <div className="hidden lg:flex w-5/12 bg-primary relative p-10 flex-col justify-between text-primary-foreground overflow-hidden">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80" />
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="carbon" width="6" height="6" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="1" fill="currentColor" opacity="0.3"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#carbon)" />
            </svg>
          </div>
          
          {/* Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2.5 bg-primary-foreground/20 rounded-xl backdrop-blur-md border border-primary-foreground/20">
              <Truck className="h-7 w-7" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Frota Link</span>
          </div>

          {/* Central Text */}
          <div className="relative z-10">
            <h2 className="text-3xl font-bold leading-tight mb-4">
              Controle total da sua operação logística.
            </h2>
            <p className="text-primary-foreground/80 text-base leading-relaxed">
              Acesse relatórios em tempo real, rastreamento de veículos e gestão de custos em uma única plataforma integrada.
            </p>
          </div>

          {/* Footer */}
          <div className="relative z-10 flex items-center gap-2 text-sm text-primary-foreground/70">
            <ShieldCheck className="h-4 w-4" />
            <span>Ambiente Seguro SSL 256-bit</span>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="w-full lg:w-7/12 bg-card p-8 lg:p-12 flex flex-col justify-center">
          
          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
            <div className="p-2 bg-primary rounded-xl">
              <Truck className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Frota Link</span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-foreground mb-2">Acesso ao Painel</h3>
            <p className="text-muted-foreground">Digite suas credenciais para continuar.</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3 animate-fade-in">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <span className="text-sm text-destructive font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* Email Field with Floating Label */}
            <div className={`relative ${shakeFields ? 'animate-shake' : ''}`}>
              <div className="relative">
                <div className={`
                  absolute left-4 top-1/2 -translate-y-1/2 
                  transition-colors duration-200
                  ${isEmailFilled ? 'text-primary' : 'text-muted-foreground'}
                `}>
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  id="email"
                  value={loginData.email}
                  onChange={(e) => {
                    setLoginData(prev => ({ ...prev, email: e.target.value }));
                    setError('');
                  }}
                  placeholder=" "
                  className={`
                    peer w-full pl-12 pr-4 pt-6 pb-2 
                    bg-muted/50 border-2 rounded-xl
                    text-foreground font-medium
                    placeholder-transparent
                    transition-all duration-200
                    focus:outline-none focus:bg-card
                    ${error ? 'border-destructive/50 focus:border-destructive' : 'border-transparent focus:border-primary'}
                    ${isEmailFilled ? 'bg-card border-primary/30' : ''}
                  `}
                  disabled={loading}
                />
                <label
                  htmlFor="email"
                  className={`
                    absolute left-12 transition-all duration-200 pointer-events-none
                    peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 
                    peer-placeholder-shown:text-base peer-placeholder-shown:text-muted-foreground
                    peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-primary
                    ${isEmailFilled ? 'top-2 translate-y-0 text-xs text-primary' : 'top-1/2 -translate-y-1/2 text-base text-muted-foreground'}
                  `}
                >
                  Email
                </label>
              </div>
            </div>

            {/* Password Field with Floating Label */}
            <div className={`relative ${shakeFields ? 'animate-shake' : ''}`}>
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
                  id="password"
                  value={loginData.password}
                  onChange={(e) => {
                    setLoginData(prev => ({ ...prev, password: e.target.value }));
                    setError('');
                  }}
                  placeholder=" "
                  className={`
                    peer w-full pl-12 pr-12 pt-6 pb-2 
                    bg-muted/50 border-2 rounded-xl
                    text-foreground font-medium
                    placeholder-transparent
                    transition-all duration-200
                    focus:outline-none focus:bg-card
                    ${error ? 'border-destructive/50 focus:border-destructive' : 'border-transparent focus:border-primary'}
                    ${isPasswordFilled ? 'bg-card border-primary/30' : ''}
                  `}
                  disabled={loading}
                />
                <label
                  htmlFor="password"
                  className={`
                    absolute left-12 transition-all duration-200 pointer-events-none
                    peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 
                    peer-placeholder-shown:text-base peer-placeholder-shown:text-muted-foreground
                    peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-primary
                    ${isPasswordFilled ? 'top-2 translate-y-0 text-xs text-primary' : 'top-1/2 -translate-y-1/2 text-base text-muted-foreground'}
                  `}
                >
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-5 h-5 border-2 border-border rounded bg-muted/50 peer-checked:bg-primary peer-checked:border-primary transition-all duration-200 flex items-center justify-center">
                    {rememberMe && <CheckCircle className="w-3 h-3 text-primary-foreground" />}
                  </div>
                </div>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">Lembrar-me</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(loginData.email);
                  setForgotPasswordOpen(true);
                }}
                className="text-primary font-medium hover:text-primary/80 hover:underline transition-all"
              >
                Esqueceu a senha?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`
                w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground 
                font-bold py-4 rounded-xl shadow-lg 
                hover:shadow-primary/30 active:scale-[0.98] 
                transition-all duration-200 
                flex items-center justify-center gap-3 
                disabled:opacity-70 disabled:cursor-not-allowed 
                group relative overflow-hidden
              `}
            >
              {/* Shine effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              
              {loading ? (
                <>
                  <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Acessar Plataforma</span>
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
          
          {/* Contact Admin */}
          <div className="mt-8 text-center">
            <p className="text-muted-foreground text-sm">
              Para solicitar acesso, entre em contato com o <span className="text-foreground font-medium">administrador</span>.
            </p>
          </div>

        </div>
      </div>
      
      {/* Copyright */}
      <div className="absolute bottom-4 text-muted-foreground/50 text-xs font-medium">
        © 2025 Frota Link Technology
      </div>

      {/* Forgot Password Modal */}
      <Dialog open={forgotPasswordOpen} onOpenChange={closeForgotPasswordModal}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {forgotSuccess ? 'E-mail enviado!' : 'Recuperar senha'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {forgotSuccess 
                ? 'Verifique sua caixa de entrada e siga as instruções.'
                : 'Digite seu e-mail para receber as instruções de recuperação.'
              }
            </DialogDescription>
          </DialogHeader>

          {forgotSuccess ? (
            <div className="py-6 text-center">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Enviamos um link de recuperação para <strong className="text-foreground">{forgotEmail}</strong>
              </p>
              <button
                onClick={closeForgotPasswordModal}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Fechar
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4 pt-2">
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                </div>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="seu@email.com"
                  disabled={forgotLoading}
                  className="w-full pl-12 pr-4 py-3 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50"
                  required
                />
              </div>

              {forgotError && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <span className="text-destructive text-sm">{forgotError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForgotPasswordModal}
                  disabled={forgotLoading}
                  className="flex-1 py-3 bg-muted border border-border text-foreground rounded-xl hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar'
                  )}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
