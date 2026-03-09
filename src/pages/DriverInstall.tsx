import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Download, Check, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function DriverInstall() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background">
      <header className="bg-primary text-primary-foreground p-6 shadow-lg">
        <div className="container max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold">App do Motorista</h1>
          <p className="text-sm opacity-90 mt-1">Instale em seu celular</p>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto p-4 space-y-6 mt-6">
        {isInstalled ? (
          <Card className="border-green-500 bg-green-50 dark:bg-green-950">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-white">
                  <Check className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-green-900 dark:text-green-100">App Instalado!</CardTitle>
                  <CardDescription className="text-green-700 dark:text-green-300">
                    O aplicativo já está instalado em seu dispositivo
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate('/driver')} 
                className="w-full h-12 text-lg"
              >
                Abrir Aplicativo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Smartphone className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle>Instalar Aplicativo</CardTitle>
                    <CardDescription>Use o app offline, direto da tela inicial</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isInstallable && !isIOS ? (
                  <Button 
                    onClick={handleInstallClick} 
                    className="w-full h-12 text-lg"
                    size="lg"
                  >
                    <Download className="mr-2 h-5 w-5" />
                    Instalar Agora
                  </Button>
                ) : isIOS && isSafari ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Para instalar no iPhone/iPad, siga os passos:
                    </p>
                    <ol className="space-y-3 text-sm">
                      <li className="flex gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">
                          1
                        </span>
                        <span>Toque no botão de compartilhar (ícone com seta para cima) na barra inferior</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">
                          2
                        </span>
                        <span>Role para baixo e toque em "Adicionar à Tela de Início"</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">
                          3
                        </span>
                        <span>Toque em "Adicionar" no canto superior direito</span>
                      </li>
                    </ol>
                  </div>
                ) : isIOS ? (
                  <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Para instalar no iPhone/iPad, você precisa abrir este site no Safari.
                    </p>
                  </div>
                ) : (
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Seu navegador não suporta instalação automática. Você ainda pode usar o aplicativo normalmente através do navegador.
                    </p>
                    <Button 
                      onClick={() => navigate('/driver')} 
                      className="w-full mt-4"
                      variant="secondary"
                    >
                      Usar no Navegador
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vantagens do App Instalado</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {[
                    'Acesso rápido direto da tela inicial',
                    'Funciona offline',
                    'Notificações em tempo real',
                    'Experiência como app nativo',
                    'Sem necessidade de ir até a loja de apps'
                  ].map((benefit, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span className="text-sm">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <div className="text-center">
              <Button 
                onClick={() => navigate('/driver')} 
                variant="outline"
                className="w-full"
              >
                Pular e Usar no Navegador
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
