import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Settings, Key, Webhook, CheckCircle, AlertTriangle, ExternalLink, Copy } from "lucide-react";

export default function PaymentSettings() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    // Generate the webhook URL based on Supabase project
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hxfhubhijampubrsqfhg.supabase.co';
    setWebhookUrl(`${supabaseUrl}/functions/v1/asaas-webhook`);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "URL copiada para a área de transferência",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações de Pagamento</h1>
        <p className="text-muted-foreground">Gerencie a integração com o gateway de pagamentos Asaas</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Key do Asaas
            </CardTitle>
            <CardDescription>
              A chave de API é armazenada de forma segura como secret no Supabase
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Secret configurado</AlertTitle>
              <AlertDescription>
                O ASAAS_API_KEY está configurado nas variáveis de ambiente do projeto.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Ambiente</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Produção</Badge>
                <span className="text-sm text-muted-foreground">
                  Use a chave de produção do Asaas
                </span>
              </div>
            </div>

            <Button variant="outline" asChild className="w-full">
              <a 
                href="https://www.asaas.com/app/configuration/api" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Acessar Painel Asaas
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhook
            </CardTitle>
            <CardDescription>
              Configure este URL no painel do Asaas para receber notificações de pagamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <div className="flex gap-2">
                <Input 
                  value={webhookUrl} 
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(webhookUrl)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Configuração necessária</AlertTitle>
              <AlertDescription>
                Adicione esta URL no painel do Asaas em: Configurações → Integrações → Webhooks
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Eventos a ativar no Asaas:</Label>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>PAYMENT_CREATED</li>
                <li>PAYMENT_RECEIVED</li>
                <li>PAYMENT_CONFIRMED</li>
                <li>PAYMENT_OVERDUE</li>
                <li>PAYMENT_DELETED</li>
                <li>PAYMENT_REFUNDED</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Funcionamento da Integração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <div className="font-semibold mb-2">1. Cadastro do Cliente</div>
              <p className="text-sm text-muted-foreground">
                Ao criar uma assinatura, a empresa é automaticamente cadastrada como cliente no Asaas.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="font-semibold mb-2">2. Cobrança Recorrente</div>
              <p className="text-sm text-muted-foreground">
                O Asaas gera automaticamente boletos/PIX mensalmente e envia para o cliente.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="font-semibold mb-2">3. Atualização Automática</div>
              <p className="text-sm text-muted-foreground">
                Quando o pagamento é confirmado, o sistema atualiza o status via webhook.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}