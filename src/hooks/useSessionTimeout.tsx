import { useEffect, useRef, useState, useCallback } from 'react';

const SESSION_START_KEY = 'linkfrota_session_start';

interface SessionTimeoutConfig {
  onTimeout: () => void;
  idleTimeout?: number; // em milissegundos
  absoluteTimeout?: number; // em milissegundos
  warningBefore?: number; // em milissegundos
}

export function useSessionTimeout({
  onTimeout,
  idleTimeout = 30 * 60 * 1000, // 30 minutos
  absoluteTimeout = 8 * 60 * 60 * 1000, // 8 horas
  warningBefore = 2 * 60 * 1000, // 2 minutos
}: SessionTimeoutConfig) {
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  
  const idleTimerRef = useRef<NodeJS.Timeout>();
  const warningTimerRef = useRef<NodeJS.Timeout>();
  const absoluteTimerRef = useRef<NodeJS.Timeout>();
  const loginTimeRef = useRef<number>(Date.now());
  const countdownIntervalRef = useRef<NodeJS.Timeout>();
  const initializedRef = useRef(false);

  const clearAllTimers = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (absoluteTimerRef.current) clearTimeout(absoluteTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  }, []);

  const handleTimeout = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    onTimeout();
  }, [onTimeout, clearAllTimers]);

  const startWarningCountdown = useCallback(() => {
    setShowWarning(true);
    setTimeLeft(warningBefore);

    countdownIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) {
          handleTimeout();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
  }, [warningBefore, handleTimeout]);

  const resetIdleTimer = useCallback(() => {
    // Limpar timers de idle e warning
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    setShowWarning(false);

    // Verificar se não passou do timeout absoluto
    const elapsedTime = Date.now() - loginTimeRef.current;
    if (elapsedTime >= absoluteTimeout) {
      handleTimeout();
      return;
    }

    // Timer para mostrar o aviso
    warningTimerRef.current = setTimeout(() => {
      startWarningCountdown();
    }, idleTimeout - warningBefore);

    // Timer para logout após idle completo
    idleTimerRef.current = setTimeout(() => {
      handleTimeout();
    }, idleTimeout);
  }, [idleTimeout, absoluteTimeout, warningBefore, handleTimeout, startWarningCountdown]);

  const extendSession = useCallback(() => {
    resetIdleTimer();
  }, [resetIdleTimer]);

  // Função para salvar timestamp no localStorage
  const saveSessionStart = useCallback((timestamp: number) => {
    try {
      localStorage.setItem(SESSION_START_KEY, String(timestamp));
    } catch (e) {
      console.warn('Não foi possível salvar timestamp de sessão');
    }
  }, []);

  // Função para ler timestamp do localStorage
  const getSessionStart = useCallback((): number | null => {
    try {
      const saved = localStorage.getItem(SESSION_START_KEY);
      return saved ? parseInt(saved, 10) : null;
    } catch (e) {
      return null;
    }
  }, []);

  // Inicialização - verificar se sessão já expirou
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const savedTimestamp = getSessionStart();
    
    if (savedTimestamp) {
      const elapsedTime = Date.now() - savedTimestamp;
      
      // Se já passou do tempo absoluto, fazer logout imediato
      if (elapsedTime >= absoluteTimeout) {
        console.log('Sessão expirada - tempo absoluto excedido');
        setSessionExpired(true);
        handleTimeout();
        return;
      }
      
      // Usar o timestamp salvo
      loginTimeRef.current = savedTimestamp;
      
      // Configurar timeout absoluto com tempo restante
      const remainingAbsoluteTime = absoluteTimeout - elapsedTime;
      absoluteTimerRef.current = setTimeout(() => {
        handleTimeout();
      }, remainingAbsoluteTime);
    } else {
      // Primeira vez logando, salvar timestamp
      loginTimeRef.current = Date.now();
      saveSessionStart(loginTimeRef.current);
      
      // Configurar timeout absoluto completo
      absoluteTimerRef.current = setTimeout(() => {
        handleTimeout();
      }, absoluteTimeout);
    }

    // Iniciar timer de idle
    resetIdleTimer();

    // Eventos que resetam o timer de idle
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    events.forEach((event) => {
      window.addEventListener(event, resetIdleTimer);
    });

    return () => {
      clearAllTimers();
      events.forEach((event) => {
        window.removeEventListener(event, resetIdleTimer);
      });
    };
  }, [resetIdleTimer, clearAllTimers, absoluteTimeout, handleTimeout, getSessionStart, saveSessionStart]);

  return {
    showWarning,
    timeLeft,
    extendSession,
    sessionExpired,
    clearSessionTimestamp: () => {
      try {
        localStorage.removeItem(SESSION_START_KEY);
      } catch (e) {}
    },
    resetSessionTimestamp: () => {
      const now = Date.now();
      loginTimeRef.current = now;
      saveSessionStart(now);
    },
  };
}
