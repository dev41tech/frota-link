import React, { useState, useEffect } from "react";
import { Truck, Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, CheckCircle } from "lucide-react";

interface LoginFormProps {
  onLogin?: (credentials: { email: string; password: string }) => Promise<void> | void;
  isLoading?: boolean;
}

export default function LoginForm({ onLogin, isLoading = false }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [internalLoading, setInternalLoading] = useState(isLoading);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [shakeField, setShakeField] = useState<"email" | "password" | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setInternalLoading(isLoading);
  }, [isLoading]);

  const validateEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    if (error) setError(null);
    setShakeField(null);
  };

  const triggerShake = (field: "email" | "password") => {
    setShakeField(field);
    setTimeout(() => setShakeField(null), 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Por favor, preencha o email.");
      triggerShake("email");
      return;
    }

    if (!validateEmail(email)) {
      setError("Por favor, insira um email válido.");
      triggerShake("email");
      return;
    }

    if (!password) {
      setError("Por favor, preencha a senha.");
      triggerShake("password");
      return;
    }

    setInternalLoading(true);

    try {
      if (onLogin) {
        await onLogin({ email, password });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (password.length < 6) {
          throw new Error("A senha deve ter no mínimo 6 caracteres.");
        }
        setSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao realizar login.");
      setInternalLoading(false);
    }
  };

  if (success && !onLogin) {
    setTimeout(() => setInternalLoading(false), 500);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-primary/90 via-slate-900 to-black font-sans selection:bg-primary/30">
      {/* Background Pattern - SVG Inline (sem dependências externas) */}
      <div className="absolute inset-0">
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      
      {/* Orbs Animados */}
      <div className="absolute top-[-20%] left-[-10%] w-[400px] h-[400px] bg-primary/30 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse [animation-delay:1s]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px]" />

      {/* Container Principal */}
      <div
        className={`
          relative z-10 w-full max-w-[420px] md:max-w-[1000px] mx-4
          bg-white/5 backdrop-blur-2xl border border-white/10 
          rounded-2xl md:rounded-3xl shadow-2xl shadow-black/20
          flex flex-col md:flex-row overflow-hidden
          transition-all duration-700 ease-out transform
          ${mounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"}
        `}
      >
        {/* LADO ESQUERDO: Branding - Hidden on Mobile */}
        <div className="hidden md:flex w-5/12 bg-gradient-to-br from-primary to-primary/80 relative p-10 flex-col justify-between text-white overflow-hidden">
          {/* Pattern Overlay */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="diagonalHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="10" style={{ stroke: "white", strokeWidth: 1 }} />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#diagonalHatch)" />
            </svg>
          </div>
          
          {/* Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md border border-white/20 shadow-lg">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-wide">Frota Link</span>
          </div>

          {/* Texto Central */}
          <div className="relative z-10">
            <h2 className="text-3xl font-bold leading-tight mb-4">
              Controle total da sua operação.
            </h2>
            <p className="text-white/80 text-sm leading-relaxed">
              Gestão de frota inteligente, rastreamento em tempo real e redução de custos operacionais.
            </p>
          </div>

          {/* Footer */}
          <div className="relative z-10 flex items-center gap-2 text-xs text-white/70">
            <ShieldCheck className="h-4 w-4" />
            <span>Ambiente Seguro SSL 256-bit</span>
          </div>
        </div>

        {/* LADO DIREITO: Formulário */}
        <div className="w-full md:w-7/12 bg-white p-6 sm:p-8 md:p-12 flex flex-col justify-center">
          
          {/* Logo Mobile Only */}
          <div className="flex md:hidden items-center justify-center gap-3 mb-8">
            <div className="p-2.5 bg-primary rounded-xl shadow-lg shadow-primary/30">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-800 tracking-wide">Frota Link</span>
          </div>

          {/* Header */}
          <div className="mb-6 md:mb-8 text-center md:text-left">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Bem-vindo de volta</h3>
            <p className="text-slate-500 text-sm">Insira suas credenciais para acessar o painel.</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 text-sm animate-fade-in">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Success State */}
          {success ? (
            <div className="flex flex-col items-center justify-center py-10 animate-scale-in">
              <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-100">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h4 className="text-xl font-bold text-slate-800">Login realizado!</h4>
              <p className="text-slate-500 text-sm mt-2">Redirecionando...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Floating Label Input - Email */}
              <div className="relative">
                <div 
                  className={`
                    relative border-2 rounded-xl transition-all duration-300
                    ${shakeField === "email" ? "animate-shake" : ""}
                    ${error && !email 
                      ? "border-red-300 bg-red-50/50" 
                      : "border-slate-200 focus-within:border-primary focus-within:shadow-lg focus-within:shadow-primary/10"
                    }
                  `}
                >
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-300 peer-focus:text-primary">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => handleInputChange(setEmail, e.target.value)}
                    placeholder=" "
                    className="peer w-full pl-12 pr-4 pt-6 pb-2 bg-transparent outline-none text-slate-800 font-medium rounded-xl"
                    disabled={internalLoading}
                  />
                  <label
                    htmlFor="email"
                    className={`
                      absolute left-12 text-slate-400 transition-all duration-300 pointer-events-none
                      peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base
                      peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-primary peer-focus:font-semibold
                      ${email ? "top-2 translate-y-0 text-xs font-semibold text-primary" : ""}
                    `}
                  >
                    Email
                  </label>
                </div>
              </div>

              {/* Floating Label Input - Password */}
              <div className="relative">
                <div 
                  className={`
                    relative border-2 rounded-xl transition-all duration-300
                    ${shakeField === "password" ? "animate-shake" : ""}
                    ${error && !password 
                      ? "border-red-300 bg-red-50/50" 
                      : "border-slate-200 focus-within:border-primary focus-within:shadow-lg focus-within:shadow-primary/10"
                    }
                  `}
                >
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-300">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => handleInputChange(setPassword, e.target.value)}
                    placeholder=" "
                    className="peer w-full pl-12 pr-12 pt-6 pb-2 bg-transparent outline-none text-slate-800 font-medium rounded-xl"
                    disabled={internalLoading}
                  />
                  <label
                    htmlFor="password"
                    className={`
                      absolute left-12 text-slate-400 transition-all duration-300 pointer-events-none
                      peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base
                      peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-primary peer-focus:font-semibold
                      ${password ? "top-2 translate-y-0 text-xs font-semibold text-primary" : ""}
                    `}
                  >
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all focus:outline-none"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Actions Row */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      disabled={internalLoading}
                    />
                    <div className="w-5 h-5 border-2 border-slate-300 rounded-md peer-checked:bg-primary peer-checked:border-primary transition-all" />
                    <svg 
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-slate-500 group-hover:text-slate-700 transition-colors">Lembrar-me</span>
                </label>
                <a href="#" className="text-primary font-semibold hover:text-primary/80 transition-colors">
                  Esqueceu a senha?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={internalLoading}
                className={`
                  w-full mt-2 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 
                  transition-all duration-300 group relative overflow-hidden
                  ${internalLoading 
                    ? "bg-slate-400 cursor-wait" 
                    : "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 active:scale-[0.98]"
                  }
                `}
              >
                {/* Hover Shine Effect */}
                {!internalLoading && (
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                )}
                
                {internalLoading ? (
                  <>
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Autenticando<span className="animate-pulse">...</span></span>
                  </>
                ) : (
                  <>
                    <span>Acessar Plataforma</span>
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer Link */}
          <div className="mt-8 text-center">
            <p className="text-slate-500 text-sm">
              Ainda não tem acesso?{" "}
              <a href="#" className="text-primary font-bold hover:underline">
                Solicitar demo
              </a>
            </p>
          </div>
          
          {/* Mobile Security Badge */}
          <div className="flex md:hidden items-center justify-center gap-2 mt-6 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4" />
            <span>Ambiente Seguro SSL 256-bit</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 text-white/30 text-xs font-medium">
        © 2025 Frota Link Technology
      </div>
    </div>
  );
}
