import { useState, useEffect } from "react";
import { Smartphone, Copy, Share2, QrCode, Check, ExternalLink, Users, ArrowRight, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureGate } from "@/components/subscription/FeatureGate";

interface DriverWithAccess {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  auth_user_id: string | null;
}

export default function DriverAppManager() {
  const { toast } = useToast();
  const { currentCompany } = useMultiTenant();
  const [copied, setCopied] = useState(false);
  const [drivers, setDrivers] = useState<DriverWithAccess[]>([]);
  const [loading, setLoading] = useState(true);

  const installUrl = `${window.location.origin}/driver/install`;

  useEffect(() => {
    const fetchDriversWithAccess = async () => {
      if (!currentCompany?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('drivers')
          .select('id, name, email, phone, auth_user_id')
          .eq('company_id', currentCompany.id)
          .eq('status', 'active')
          .not('auth_user_id', 'is', null);
        
        if (error) throw error;
        setDrivers(data || []);
      } catch (error) {
        console.error('Error fetching drivers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDriversWithAccess();
  }, [currentCompany?.id]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(installUrl);
      setCopied(true);
      toast({
        title: "Link copiado!",
        description: "O link foi copiado para a área de transferência.",
      });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  };

  const shareViaWhatsApp = () => {
    const message = encodeURIComponent(
      `📱 *App do Motorista - Frota Link*\n\n` +
      `Instale o aplicativo para gerenciar suas viagens:\n\n` +
      `${installUrl}\n\n` +
      `Após instalar, faça login com suas credenciais.`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const generateQRCode = () => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(installUrl)}`;
  };

  return (
    <FeatureGate feature="pwaDriver" fallback="upgrade">
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">App do Motorista</h1>
            <p className="text-muted-foreground">Gere e compartilhe o link de instalação do app</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Link de Instalação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Link de Instalação
              </CardTitle>
              <CardDescription>
                Compartilhe este link com seus motoristas para que instalem o app
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* URL Display */}
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
                <code className="flex-1 text-sm text-foreground break-all font-mono">
                  {installUrl}
                </code>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="default" 
                  onClick={copyToClipboard}
                  className="flex-1"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar Link
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={shareViaWhatsApp}
                  className="flex-1 text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Enviar via WhatsApp
                </Button>
              </div>

              {/* Instructions */}
              <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                <h4 className="font-semibold text-foreground mb-2">Como funciona:</h4>
                <ol className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                    <span>Envie o link para o motorista via WhatsApp ou outro meio</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                    <span>O motorista abre o link no celular e instala o app</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                    <span>Após instalação, o motorista faz login com suas credenciais</span>
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* QR Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                QR Code
              </CardTitle>
              <CardDescription>
                O motorista pode escanear este código com a câmera do celular
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="p-4 bg-white rounded-xl shadow-inner">
                <img 
                  src={generateQRCode()} 
                  alt="QR Code para instalação do app"
                  className="w-48 h-48"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Aponte a câmera do celular para o QR Code
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Motoristas com Acesso */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Motoristas com Acesso ao App
            </CardTitle>
            <CardDescription>
              Lista de motoristas que já possuem credenciais para acessar o app
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : drivers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum motorista com acesso configurado</p>
                <Button 
                  variant="link" 
                  className="mt-2"
                  onClick={() => window.location.href = '/drivers'}
                >
                  Ir para Motoristas
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {drivers.map((driver) => (
                  <div key={driver.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">
                          {driver.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{driver.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {driver.email || driver.phone || 'Sem contato'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded-full">
                        Acesso ativo
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </FeatureGate>
  );
}
