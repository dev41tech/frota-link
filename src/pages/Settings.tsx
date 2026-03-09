import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, 
  Bell, 
  Database, 
  Mail, 
  Save, 
  FileKey, 
  Lock, 
  Eye, 
  EyeOff, 
  CreditCard,
  Settings as SettingsIcon,
  Sliders,
  Crown,
  Phone,
  MessageCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CertificateManager } from '@/components/cte/CertificateManager';

interface UserSettings {
  notifications_email: boolean;
  notifications_push: boolean;
  auto_backup: boolean;
  default_currency: string;
  date_format: string;
  timezone: string;
  language: string;
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { planName, hasDedicatedSupport, isLoading: planLoading } = usePlanFeatures();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    notifications_email: true,
    notifications_push: true,
    auto_backup: true,
    default_currency: 'BRL',
    date_format: 'DD/MM/YYYY',
    timezone: 'America/Sao_Paulo',
    language: 'pt-BR'
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    company_name: '',
    phone: ''
  });

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchUserSettings();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfileData({
          full_name: data.full_name || '',
          email: data.email || '',
          company_name: data.company_name || '',
          phone: data.phone || ''
        });
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchUserSettings = async () => {
    const savedSettings = localStorage.getItem('frotalink_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  };

  const saveProfile = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          company_name: profileData.company_name,
          phone: profileData.phone
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso!"
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const validatePasswordStrength = (password: string): { isValid: boolean; message: string } => {
    if (password.length < 8) {
      return { isValid: false, message: "A senha deve ter no mínimo 8 caracteres" };
    }

    const hasLowerCase = /[a-z]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password);

    if (!hasLowerCase) {
      return { isValid: false, message: "A senha deve conter pelo menos uma letra minúscula" };
    }
    if (!hasUpperCase) {
      return { isValid: false, message: "A senha deve conter pelo menos uma letra maiúscula" };
    }
    if (!hasNumber) {
      return { isValid: false, message: "A senha deve conter pelo menos um número" };
    }
    if (!hasSpecialChar) {
      return { isValid: false, message: "A senha deve conter pelo menos um caractere especial (!@#$%^&*...)" };
    }

    return { isValid: true, message: "Senha forte" };
  };

  const changePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos de senha",
        variant: "destructive"
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Erro",
        description: "A nova senha e a confirmação não coincidem",
        variant: "destructive"
      });
      return;
    }

    const passwordValidation = validatePasswordStrength(passwordData.newPassword);
    if (!passwordValidation.isValid) {
      toast({
        title: "Senha fraca",
        description: passwordValidation.message,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Senha alterada com sucesso"
      });

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      localStorage.setItem('frotalink_settings', JSON.stringify(settings));

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso!"
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    toast({
      title: "Exportando dados",
      description: "Funcionalidade de exportação será implementada em breve."
    });
  };

  const importData = async () => {
    toast({
      title: "Importando dados",
      description: "Funcionalidade de importação será implementada em breve."
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas preferências e configurações do sistema</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Segurança</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Sliders className="h-4 w-4" />
            <span className="hidden sm:inline">Preferências</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Dados</span>
          </TabsTrigger>
          <TabsTrigger value="plan" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Plano</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações do Perfil
              </CardTitle>
              <CardDescription>Atualize suas informações pessoais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo</Label>
                  <Input
                    id="full_name"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_name">Nome da Empresa</Label>
                  <Input
                    id="company_name"
                    value={profileData.company_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, company_name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={profileData.phone}
                    onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>

              <Button onClick={saveProfile} disabled={loading} className="bg-gradient-primary">
                <Save className="h-4 w-4 mr-2" />
                Salvar Perfil
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-6 space-y-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Alterar Senha
              </CardTitle>
              <CardDescription>Mantenha sua conta segura atualizando sua senha regularmente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Senha Atual</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showPasswords.current ? "text" : "password"}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="Digite sua senha atual"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                    >
                      {showPasswords.current ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPasswords.new ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Mínimo 8 caracteres"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                    >
                      {showPasswords.new ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Digite novamente"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                    >
                      {showPasswords.confirm ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
              </div>

              {passwordData.newPassword && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm p-3 bg-muted/50 rounded-lg">
                  <span className={passwordData.newPassword.length >= 8 ? "text-green-600" : "text-muted-foreground"}>• 8+ caracteres</span>
                  <span className={/[a-z]/.test(passwordData.newPassword) ? "text-green-600" : "text-muted-foreground"}>• Minúscula</span>
                  <span className={/[A-Z]/.test(passwordData.newPassword) ? "text-green-600" : "text-muted-foreground"}>• Maiúscula</span>
                  <span className={/[0-9]/.test(passwordData.newPassword) ? "text-green-600" : "text-muted-foreground"}>• Número</span>
                  <span className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(passwordData.newPassword) ? "text-green-600" : "text-muted-foreground"}>• Especial</span>
                </div>
              )}

              {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                <p className="text-sm text-destructive">As senhas não coincidem</p>
              )}

              <Button onClick={changePassword} disabled={loading}>
                <Lock className="mr-2 h-4 w-4" />
                Alterar Senha
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileKey className="h-5 w-5" />
                Certificado Digital
              </CardTitle>
              <CardDescription>Gerencie seus certificados digitais para emissão de CT-e</CardDescription>
            </CardHeader>
            <CardContent>
              <CertificateManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="mt-6 space-y-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificações
              </CardTitle>
              <CardDescription>Configure como deseja receber notificações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">Notificações por Email</Label>
                  <p className="text-sm text-muted-foreground">Receba atualizações importantes por email</p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={settings.notifications_email}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notifications_email: checked }))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="push-notifications">Notificações Push</Label>
                  <p className="text-sm text-muted-foreground">Receba notificações em tempo real</p>
                </div>
                <Switch
                  id="push-notifications"
                  checked={settings.notifications_push}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notifications_push: checked }))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-backup">Backup Automático</Label>
                  <p className="text-sm text-muted-foreground">Backup automático dos dados diariamente</p>
                </div>
                <Switch
                  id="auto-backup"
                  checked={settings.auto_backup}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_backup: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Preferências do Sistema
              </CardTitle>
              <CardDescription>Personalize o comportamento do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Moeda Padrão</Label>
                  <Select 
                    value={settings.default_currency} 
                    onValueChange={(value) => setSettings(prev => ({ ...prev, default_currency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">Real (R$)</SelectItem>
                      <SelectItem value="USD">Dólar ($)</SelectItem>
                      <SelectItem value="EUR">Euro (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date-format">Formato de Data</Label>
                  <Select 
                    value={settings.date_format} 
                    onValueChange={(value) => setSettings(prev => ({ ...prev, date_format: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/AAAA</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/AAAA</SelectItem>
                      <SelectItem value="YYYY-MM-DD">AAAA-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Fuso Horário</Label>
                  <Select 
                    value={settings.timezone} 
                    onValueChange={(value) => setSettings(prev => ({ ...prev, timezone: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Sao_Paulo">Brasília (UTC-3)</SelectItem>
                      <SelectItem value="America/New_York">Nova York (UTC-5)</SelectItem>
                      <SelectItem value="Europe/London">Londres (UTC+0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Idioma</Label>
                  <Select 
                    value={settings.language} 
                    onValueChange={(value) => setSettings(prev => ({ ...prev, language: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="es-ES">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={saveSettings} disabled={loading} className="bg-gradient-primary">
                <Save className="h-4 w-4 mr-2" />
                Salvar Preferências
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="mt-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Gerenciamento de Dados
              </CardTitle>
              <CardDescription>Exporte, importe ou limpe dados do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2 p-4 border rounded-lg">
                  <h4 className="font-medium">Exportar Dados</h4>
                  <p className="text-sm text-muted-foreground">Baixe todos os seus dados em formato CSV</p>
                  <Button onClick={exportData} variant="outline" className="w-full mt-2">
                    Exportar Dados
                  </Button>
                </div>

                <div className="space-y-2 p-4 border rounded-lg">
                  <h4 className="font-medium">Importar Dados</h4>
                  <p className="text-sm text-muted-foreground">Importe dados de planilhas CSV</p>
                  <Button onClick={importData} variant="outline" className="w-full mt-2">
                    Importar Dados
                  </Button>
                </div>

                <div className="space-y-2 p-4 border rounded-lg">
                  <h4 className="font-medium">Limpar Cache</h4>
                  <p className="text-sm text-muted-foreground">Limpe o cache para melhorar a performance</p>
                  <Button 
                    onClick={() => {
                      localStorage.clear();
                      toast({ title: "Cache limpo!", description: "O cache foi limpo com sucesso." });
                    }} 
                    variant="outline" 
                    className="w-full mt-2"
                  >
                    Limpar Cache
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plan Tab */}
        <TabsContent value="plan" className="mt-6 space-y-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Assinatura
              </CardTitle>
              <CardDescription>Informações do seu plano atual</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border">
                <Label className="text-sm text-muted-foreground">Plano Atual</Label>
                <p className="text-2xl font-bold mt-1">
                  {planLoading ? 'Carregando...' : (planName || 'Não definido')}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Para alterar seu plano, entre em contato com o suporte.
              </p>
            </CardContent>
          </Card>

          {/* Dedicated Support Section - Only for Concierge Plan */}
          {hasDedicatedSupport && (
            <Card className="shadow-card border-2 border-amber-500/30 bg-gradient-to-br from-amber-50/50 to-amber-100/30 dark:from-amber-950/20 dark:to-amber-900/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Crown className="h-5 w-5" />
                  Suporte Dedicado Concierge
                </CardTitle>
                <CardDescription>Você tem acesso a um especialista exclusivo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-800">
                    <User className="h-10 w-10 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-semibold">Seu Especialista</p>
                      <p className="text-muted-foreground">João Silva</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-800">
                    <Phone className="h-10 w-10 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-semibold">WhatsApp Direto</p>
                      <a 
                        href="https://wa.me/5511999999999" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        (11) 99999-9999
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-800">
                    <Mail className="h-10 w-10 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-semibold">Email Prioritário</p>
                      <a 
                        href="mailto:concierge@frotalink.com.br" 
                        className="text-primary hover:underline"
                      >
                        concierge@frotalink.com.br
                      </a>
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-800 dark:text-amber-300">
                  <MessageCircle className="h-4 w-4 inline mr-2" />
                  Atendimento prioritário 24/7 • Consultoria mensal inclusa • Onboarding personalizado
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Suporte e Informações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <h3 className="font-semibold mb-2">Versão do Sistema</h3>
                  <p className="text-muted-foreground">Frota Link v1.0.0</p>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <h3 className="font-semibold mb-2">Suporte Técnico</h3>
                  <p className="text-muted-foreground">suporte@frotalink.com.br</p>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <h3 className="font-semibold mb-2">Última Atualização</h3>
                  <p className="text-muted-foreground">{new Date().toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
