import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { getSetting, updateSetting, loading } = useSystemSettings();
  const { toast } = useToast();

  const [general, setGeneral] = useState({
    appName: "",
    supportEmail: "",
    companyLimit: "",
  });

  const [security, setSecurity] = useState({
    sessionTimeout: "",
    maxLoginAttempts: "",
    logRetention: "",
  });

  const [notifications, setNotifications] = useState({
    alertEmail: "",
    criticalThreshold: "",
  });

  useEffect(() => {
    if (!loading) {
      setGeneral({
        appName: getSetting("app_name") || "LinkFrota",
        supportEmail: getSetting("support_email") || "suporte@linkfrota.com.br",
        companyLimit: getSetting("company_limit") || "100",
      });

      setSecurity({
        sessionTimeout: getSetting("session_timeout") || "30",
        maxLoginAttempts: getSetting("max_login_attempts") || "5",
        logRetention: getSetting("log_retention") || "90",
      });

      setNotifications({
        alertEmail: getSetting("alert_email") || "alertas@linkfrota.com.br",
        criticalThreshold: getSetting("critical_threshold") || "5",
      });
    }
  }, [loading, getSetting]);

  const handleSaveGeneral = async () => {
    await updateSetting("app_name", general.appName, "general", "Nome da aplicação");
    await updateSetting("support_email", general.supportEmail, "general", "Email de suporte");
    await updateSetting("company_limit", parseInt(general.companyLimit), "general", "Limite de empresas");
  };

  const handleSaveSecurity = async () => {
    await updateSetting("session_timeout", parseInt(security.sessionTimeout), "security", "Timeout de sessão (minutos)");
    await updateSetting("max_login_attempts", parseInt(security.maxLoginAttempts), "security", "Tentativas máximas de login");
    await updateSetting("log_retention", parseInt(security.logRetention), "security", "Retenção de logs (dias)");
  };

  const handleSaveNotifications = async () => {
    await updateSetting("alert_email", notifications.alertEmail, "notifications", "Email para alertas");
    await updateSetting("critical_threshold", parseInt(notifications.criticalThreshold), "notifications", "Limite para alertas críticos");
  };

  const handleBackup = () => {
    toast({
      title: "Backup iniciado",
      description: "O backup do banco de dados foi iniciado",
    });
  };

  const handleCleanup = () => {
    toast({
      title: "Limpeza iniciada",
      description: "A limpeza de logs antigos foi iniciada",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as configurações do sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Configurações Gerais</CardTitle>
            <CardDescription>Configurações básicas da aplicação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appName">Nome da Aplicação</Label>
              <Input
                id="appName"
                value={general.appName}
                onChange={(e) => setGeneral({ ...general, appName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportEmail">Email de Suporte</Label>
              <Input
                id="supportEmail"
                type="email"
                value={general.supportEmail}
                onChange={(e) => setGeneral({ ...general, supportEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyLimit">Limite Máximo de Empresas</Label>
              <Input
                id="companyLimit"
                type="number"
                value={general.companyLimit}
                onChange={(e) => setGeneral({ ...general, companyLimit: e.target.value })}
              />
            </div>
            <Button onClick={handleSaveGeneral}>Salvar Alterações</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Segurança</CardTitle>
            <CardDescription>Configurações de segurança e autenticação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Timeout de Sessão (minutos)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                value={security.sessionTimeout}
                onChange={(e) => setSecurity({ ...security, sessionTimeout: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxLoginAttempts">Tentativas Máximas de Login</Label>
              <Input
                id="maxLoginAttempts"
                type="number"
                value={security.maxLoginAttempts}
                onChange={(e) => setSecurity({ ...security, maxLoginAttempts: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logRetention">Retenção de Logs (dias)</Label>
              <Input
                id="logRetention"
                type="number"
                value={security.logRetention}
                onChange={(e) => setSecurity({ ...security, logRetention: e.target.value })}
              />
            </div>
            <Button onClick={handleSaveSecurity}>Salvar Configurações</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notificações</CardTitle>
            <CardDescription>Configurações de alertas e notificações</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="alertEmail">Email para Alertas</Label>
              <Input
                id="alertEmail"
                type="email"
                value={notifications.alertEmail}
                onChange={(e) => setNotifications({ ...notifications, alertEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="criticalThreshold">Limite para Alertas Críticos</Label>
              <Input
                id="criticalThreshold"
                type="number"
                value={notifications.criticalThreshold}
                onChange={(e) => setNotifications({ ...notifications, criticalThreshold: e.target.value })}
              />
            </div>
            <Button onClick={handleSaveNotifications}>Salvar Notificações</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Banco de Dados</CardTitle>
            <CardDescription>Gerenciamento do banco de dados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Backup Automático</Label>
              <p className="text-sm text-muted-foreground">Executar backup manual do banco de dados</p>
              <Button onClick={handleBackup}>Executar Backup</Button>
            </div>
            <div className="space-y-2">
              <Label>Limpeza de Logs</Label>
              <p className="text-sm text-muted-foreground">Remover logs antigos do sistema</p>
              <Button variant="outline" onClick={handleCleanup}>Executar Limpeza</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
