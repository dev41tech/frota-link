import { Lock, Sparkles, Check, MessageCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface UpgradePromptProps {
  featureName: string;
  requiredPlan: string;
  currentPlan: string | null;
  onClose?: () => void;
}

const planDetails: Record<string, { price: string; features: string[] }> = {
  Pro: {
    price: 'R$ 79,90/placa',
    features: [
      'Simulador de Frete',
      'Assistente IA Completo',
      'Copilot Flutuante',
      'Relatórios Avançados',
    ],
  },
  Enterprise: {
    price: 'R$ 89,90/placa',
    features: [
      'Tudo do plano Pro',
      'App Motorista (PWA)',
      'Checklists de Viagem',
      'Geolocalização',
      'Chat Integrado',
    ],
  },
  Concierge: {
    price: 'A partir de R$ 170,00',
    features: [
      'Tudo do plano Enterprise',
      'Suporte Dedicado 24/7',
      'Especialista Exclusivo',
      'Onboarding Personalizado',
      'Consultoria Mensal',
    ],
  },
  'Add-on': {
    price: 'Sob consulta',
    features: [
      'Habilitação individual do módulo',
      'Limite de uso configurável',
      'Independente do plano base',
      'Ativação imediata',
    ],
  },
  'Módulo Adicional': {
    price: 'Sob consulta',
    features: [
      'Habilitação individual do módulo',
      'Limite de uso configurável',
      'Independente do plano base',
      'Ativação imediata',
    ],
  },
};

export function UpgradePrompt({ featureName, requiredPlan, currentPlan, onClose }: UpgradePromptProps) {
  const planInfo = planDetails[requiredPlan] || planDetails.Pro;
  
  const handleContactSupport = () => {
    const message = encodeURIComponent(
      `Olá! Tenho interesse em fazer upgrade para o plano ${requiredPlan} para acessar ${featureName}. Meu plano atual é ${currentPlan || 'Controle'}.`
    );
    window.open(`https://wa.me/5511999999999?text=${message}`, '_blank');
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-lg w-full shadow-lg border-2 border-primary/20">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Recurso Premium</CardTitle>
          <CardDescription className="text-base mt-2">
            <span className="font-semibold text-foreground">{featureName}</span> está disponível a partir do plano{' '}
            <span className="font-semibold text-primary">{requiredPlan}</span>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Plan Card */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-5 border border-primary/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-bold text-lg">Plano {requiredPlan}</span>
              </div>
              <span className="text-sm font-semibold text-primary">{planInfo.price}</span>
            </div>
            
            <ul className="space-y-2">
              {planInfo.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Current Plan Info */}
          <div className="text-center text-sm text-muted-foreground">
            Seu plano atual: <span className="font-medium">{currentPlan || 'Controle'}</span> (R$ 59,90/placa)
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button 
              size="lg" 
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              onClick={handleContactSupport}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Falar com Comercial
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            
            {onClose && (
              <Button variant="ghost" size="lg" className="w-full" onClick={onClose}>
                Continuar com {currentPlan || 'Controle'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
