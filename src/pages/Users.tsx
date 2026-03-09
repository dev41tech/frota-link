import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { createUserWithEmailNotification } from '@/lib/userManagement';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, User, Mail, Shield, Edit, Trash2, Key, Link, Building2, Eye, EyeOff, Copy, RefreshCw, RotateCcw, Route, CheckCircle2, DollarSign, Play, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { generateSecurePassword } from '@/lib/userManagement';
import CompanyLinkDialog from '@/components/users/CompanyLinkDialog';
import { GestorPermissionsDialog } from '@/components/users/GestorPermissionsDialog';
import { formatDateBR } from '@/lib/utils';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  company_name: string;
  phone: string;
  role: 'master' | 'admin' | 'gestor' | 'motorista' | 'driver' | 'bpo' | 'suporte';
  created_at: string;
  companies?: {
    name: string;
  };
}

export default function Users() {
  const { user } = useAuth();
  const { userProfile, currentCompany, availableCompanies, hasPermission } = useMultiTenant();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [userToResetPassword, setUserToResetPassword] = useState<{ id: string; name: string; email: string } | null>(null);
  const [newTemporaryPassword, setNewTemporaryPassword] = useState('');
  const [companyLinkDialogOpen, setCompanyLinkDialogOpen] = useState(false);
  const [userToLink, setUserToLink] = useState<{ id: string; name: string; companyId?: string } | null>(null);
  const [gestorPermissionsDialogOpen, setGestorPermissionsDialogOpen] = useState(false);
  const [gestorPermissionsTarget, setGestorPermissionsTarget] = useState<{ userId: string; userName: string; companyId: string } | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    company_name: '',
    company_id: '',
    phone: '',
    role: 'admin' as 'master' | 'admin' | 'gestor' | 'motorista' | 'driver' | 'bpo' | 'suporte',
    temporary_password: ''
  });

  const [driverPermissions, setDriverPermissions] = useState({
    can_start_journey: true,
    can_create_journey_without_approval: false,
    can_auto_close_journey: false,
    can_add_revenue: false,
  });

  // Map of user_id -> driver permissions for table badges
  const [driversPermissionsMap, setDriversPermissionsMap] = useState<Record<string, typeof driverPermissions>>({});

  const [showPassword, setShowPassword] = useState(false);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      // PHASE 2: Fetch users with dual-read (user_roles + profiles.role fallback)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          *,
          companies!profiles_company_id_fkey (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get roles from user_roles table for all users
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      // Create a map of user_id -> role
      const rolesMap = new Map(
        rolesData?.map(r => [r.user_id, r.role]) || []
      );

      // Merge data: prioritize user_roles, fallback to profiles.role
      let usersWithRoles = (profilesData || []).map(profile => ({
        ...profile,
        role: rolesMap.get(profile.user_id) || profile.role
      }));

      // Filter by company if not master
      if (userProfile?.role !== 'master' && currentCompany?.id) {
        usersWithRoles = usersWithRoles.filter(u => u.company_id === currentCompany.id);
      }

      // Fetch driver permissions for motorista users
      const driverUserIds = usersWithRoles
        .filter(u => u.role === 'motorista' || u.role === 'driver')
        .map(u => u.user_id);

      if (driverUserIds.length > 0) {
        const { data: driversData } = await supabase
          .from('drivers')
          .select('auth_user_id, can_start_journey, can_create_journey_without_approval, can_auto_close_journey, can_add_revenue')
          .in('auth_user_id', driverUserIds);

        const permMap: Record<string, typeof driverPermissions> = {};
        driversData?.forEach(d => {
          if (d.auth_user_id) {
            permMap[d.auth_user_id] = {
              can_start_journey: d.can_start_journey ?? true,
              can_create_journey_without_approval: d.can_create_journey_without_approval ?? false,
              can_auto_close_journey: d.can_auto_close_journey ?? false,
              can_add_revenue: d.can_add_revenue ?? false,
            };
          }
        });
        setDriversPermissionsMap(permMap);
      }

      setUsers(usersWithRoles);
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

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      company_name: '',
      company_id: '',
      phone: '',
      role: 'admin' as 'master' | 'admin' | 'gestor' | 'motorista',
      temporary_password: generateSecurePassword()
    });
    setDriverPermissions({
      can_start_journey: true,
      can_create_journey_without_approval: false,
      can_auto_close_journey: false,
      can_add_revenue: false,
    });
    setEditingUser(null);
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check permissions
    if (!hasPermission('manage_users')) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para gerenciar usuários.",
        variant: "destructive"
      });
      return;
    }

    // Ensure company is selected
    let selectedCompanyId = '';
    if (userProfile?.role === 'master') {
      if (!formData.company_id) {
        toast({
          title: "Erro",
          description: "Selecione uma empresa para o usuário.",
          variant: "destructive"
        });
        return;
      }
      selectedCompanyId = formData.company_id;
    } else {
      if (!currentCompany?.id) {
        toast({
          title: "Erro",
          description: "Nenhuma empresa selecionada.",
          variant: "destructive"
        });
        return;
      }
      selectedCompanyId = currentCompany.id;
    }

    try {
      if (editingUser) {
        // Update existing user profile
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            phone: formData.phone,
            role: formData.role as 'master' | 'admin' | 'gestor' | 'motorista'
          })
          .eq('id', editingUser.id);

        if (error) throw error;

        // Update driver permissions if motorista
        if (formData.role === 'motorista' || formData.role === 'driver') {
          await supabase
            .from('drivers')
            .update({
              can_start_journey: driverPermissions.can_start_journey,
              can_create_journey_without_approval: driverPermissions.can_create_journey_without_approval,
              can_auto_close_journey: driverPermissions.can_auto_close_journey,
              can_add_revenue: driverPermissions.can_add_revenue,
            })
            .eq('auth_user_id', editingUser.user_id);
        }
        
        toast({
          title: "Sucesso",
          description: "Usuário atualizado com sucesso!"
        });
      } else {
        // Create new user with email notification
        const result = await createUserWithEmailNotification({
          email: formData.email,
          full_name: formData.full_name,
          company_id: selectedCompanyId,
          role: formData.role as 'admin' | 'gestor' | 'motorista',
          phone: formData.phone,
          created_by_name: userProfile?.full_name || 'Administrador',
          temporary_password: formData.temporary_password
        });

        if (!result.success) {
          throw new Error(result.error);
        }
        
        toast({
          title: "Sucesso",
          description: `Usuário criado com sucesso! Senha temporária: ${result.temporary_password || formData.temporary_password}. Um email foi enviado com as credenciais.`
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleEdit = async (userProf: UserProfile) => {
    setEditingUser(userProf);
    setFormData({
      full_name: userProf.full_name || '',
      email: userProf.email || '',
      company_name: userProf.company_name || '',
      company_id: '',
      phone: userProf.phone || '',
      role: userProf.role || 'admin',
      temporary_password: ''
    });

    // Load driver permissions if motorista
    if (userProf.role === 'motorista' || userProf.role === 'driver') {
      const { data: driverData } = await supabase
        .from('drivers')
        .select('can_start_journey, can_create_journey_without_approval, can_auto_close_journey, can_add_revenue')
        .eq('auth_user_id', userProf.user_id)
        .maybeSingle();

      if (driverData) {
        setDriverPermissions({
          can_start_journey: driverData.can_start_journey ?? true,
          can_create_journey_without_approval: driverData.can_create_journey_without_approval ?? false,
          can_auto_close_journey: driverData.can_auto_close_journey ?? false,
          can_add_revenue: driverData.can_add_revenue ?? false,
        });
      } else {
        setDriverPermissions({
          can_start_journey: true,
          can_create_journey_without_approval: false,
          can_auto_close_journey: false,
          can_add_revenue: false,
        });
      }
    }

    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!hasPermission('manage_users')) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para excluir usuários.",
        variant: "destructive"
      });
      return;
    }

    if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) return;

    try {
      // Note: In a production app, you might want to deactivate instead of delete
      toast({
        title: "Aviso",
        description: "Função de exclusão será implementada. Por segurança, usuários devem ser desativados ao invés de excluídos."
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Senha alterada com sucesso!"
      });

      setPasswordDialogOpen(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleResetPassword = async (targetUser: UserProfile) => {
    if (!hasPermission('manage_users')) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para resetar senhas.",
        variant: "destructive"
      });
      return;
    }

    try {
      const tempPassword = generateSecurePassword();
      
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          user_id: targetUser.user_id,
          email: targetUser.email,
          new_password: tempPassword,
          user_name: targetUser.full_name,
          created_by_name: userProfile?.full_name || 'Administrador'
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error);
      }

      // Use the password returned from the backend if available, otherwise use the generated one
      const finalPassword = data?.temporary_password || tempPassword;
      setNewTemporaryPassword(finalPassword);
      setUserToResetPassword({
        id: targetUser.id,
        name: targetUser.full_name || targetUser.email,
        email: targetUser.email
      });
      setResetPasswordDialogOpen(true);

      toast({
        title: "Sucesso",
        description: `Senha resetada para ${targetUser.full_name}. Nova senha temporária gerada.`
      });

    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'master': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-red-100 text-red-800';
      case 'gestor': return 'bg-blue-100 text-blue-800';
      case 'motorista': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'master': return 'Master';
      case 'admin': return 'Administrador';
      case 'gestor': return 'Gestor';
      case 'motorista': return 'Motorista';
      default: return role;
    }
  };

  const formatDate = (dateString: string) => {
    return formatDateBR(dateString);
  };

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">Gerencie os usuários do sistema</p>
        </div>
        
        <div className="flex space-x-3">
          <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Key className="h-4 w-4 mr-2" />
                Alterar Senha
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Alterar Senha</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Senha Atual</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-gradient-primary">
                    Alterar Senha
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-gradient-primary shadow-primary" 
                  onClick={() => {
                    resetForm();
                    setFormData(prev => ({ ...prev, temporary_password: generateSecurePassword() }));
                  }}
                  disabled={!hasPermission('manage_users')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nome Completo *</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      disabled={!!editingUser}
                      required
                    />
                  </div>
                </div>

                {/* Company Selection for Master Users */}
                {userProfile?.role === 'master' && !editingUser && (
                  <div className="space-y-2">
                    <Label htmlFor="company">Empresa *</Label>
                    <Select value={formData.company_id} onValueChange={(value) => setFormData(prev => ({ ...prev, company_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma empresa" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        {availableCompanies
                              .filter((company) => company.id && company.id !== '')
                                .map((company) => (
                                       <SelectItem key={company.id} value={company.id}>
                                      <div className="flex flex-col items-start">
                              <span className="font-medium">{company.name}</span>
                         <span className="text-xs text-muted-foreground">{company.cnpj}</span>
                      </div>
                     </SelectItem>
                                  
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="role">Função</Label>
                    <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as 'master' | 'admin' | 'gestor' | 'motorista' }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        {userProfile?.role === 'master' && (
                          <SelectItem value="admin">Administrador</SelectItem>
                        )}
                        {(userProfile?.role === 'master' || userProfile?.role === 'admin') && (
                          <>
                            <SelectItem value="gestor">Gestor</SelectItem>
                            <SelectItem value="motorista">Motorista</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Driver Permissions Section */}
                {editingUser && (formData.role === 'motorista' || formData.role === 'driver') && (
                  <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Permissões do App do Motorista
                    </Label>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Iniciar Jornada</p>
                          <p className="text-xs text-muted-foreground">Permite iniciar jornadas pelo app</p>
                        </div>
                        <Switch
                          checked={driverPermissions.can_start_journey}
                          onCheckedChange={(checked) => setDriverPermissions(prev => ({
                            ...prev,
                            can_start_journey: checked,
                            ...(checked ? {} : { can_create_journey_without_approval: false })
                          }))}
                        />
                      </div>

                      {driverPermissions.can_start_journey && (
                        <div className="flex items-center justify-between ml-4">
                          <div>
                            <p className="text-sm font-medium">Criar Jornadas sem Aprovação</p>
                            <p className="text-xs text-muted-foreground">Jornada inicia direto sem aprovação do gestor</p>
                          </div>
                          <Switch
                            checked={driverPermissions.can_create_journey_without_approval}
                            onCheckedChange={(checked) => setDriverPermissions(prev => ({ ...prev, can_create_journey_without_approval: checked }))}
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Encerrar Jornada sem Aprovação</p>
                          <p className="text-xs text-muted-foreground">Encerra direto sem solicitar aprovação</p>
                        </div>
                        <Switch
                          checked={driverPermissions.can_auto_close_journey}
                          onCheckedChange={(checked) => setDriverPermissions(prev => ({ ...prev, can_auto_close_journey: checked }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Lançar Receitas</p>
                          <p className="text-xs text-muted-foreground">Permite registrar receitas pelo app</p>
                        </div>
                        <Switch
                          checked={driverPermissions.can_add_revenue}
                          onCheckedChange={(checked) => setDriverPermissions(prev => ({ ...prev, can_add_revenue: checked }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {!editingUser && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="temporary_password">Senha Temporária *</Label>
                      <div className="flex space-x-2">
                        <div className="relative flex-1">
                          <Input
                            id="temporary_password"
                            type={showPassword ? "text" : "password"}
                            value={formData.temporary_password}
                            onChange={(e) => setFormData(prev => ({ ...prev, temporary_password: e.target.value }))}
                            required
                            readOnly
                            className="pr-20"
                          />
                          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => navigator.clipboard.writeText(formData.temporary_password)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setFormData(prev => ({ ...prev, temporary_password: generateSecurePassword() }))}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">🔐 Informações de Acesso</h4>
                      <div className="text-sm text-blue-800 space-y-1">
                        <p>• A senha temporária acima será enviada para o usuário</p>
                        <p>• O usuário receberá um email com as credenciais</p>
                        <p>• No primeiro login será obrigatório alterar a senha</p>
                        <p>• Você pode gerar uma nova senha clicando no botão de atualizar</p>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-gradient-primary">
                    {editingUser ? 'Atualizar' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Alert for users without company */}
      {users.some(user => !user.companies?.name && user.role !== 'master') && (
        <Card className="shadow-card border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-orange-800">
              <Building2 className="h-5 w-5" />
              <span>Atenção: Usuários sem vínculo empresarial</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700 text-sm mb-3">
              Alguns usuários não estão vinculados a uma empresa. Isso pode impedir o acesso a dados específicos da empresa.
            </p>
            <div className="space-y-1">
              {users
                .filter(user => !user.companies?.name && user.role !== 'master')
                .map(user => (
                  <div key={user.id} className="flex items-center justify-between bg-orange-100 rounded p-2">
                    <span className="text-orange-800 text-sm font-medium">
                      {user.full_name || user.email}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-orange-700 border-orange-300 hover:bg-orange-200"
                      onClick={() => {
                        setUserToLink({
                          id: user.id,
                          name: user.full_name || user.email,
                          companyId: undefined
                        });
                        setCompanyLinkDialogOpen(true);
                      }}
                    >
                      <Link className="h-3 w-3 mr-1" />
                      Vincular
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current User Info */}
      <Card className="shadow-card border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-blue-800">
            <User className="h-5 w-5" />
            <span>Meu Perfil</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-blue-600 font-medium">Nome</p>
              <p className="text-blue-800">{userProfile?.full_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-blue-600 font-medium">Email</p>
              <p className="text-blue-800">{user?.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-blue-600 font-medium">Função</p>
              <Badge className={getRoleColor(userProfile?.role || 'admin')}>{getRoleText(userProfile?.role || 'admin')}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((userProfile) => (
                <TableRow key={userProfile.id}>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{userProfile.full_name || 'N/A'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{userProfile.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>{userProfile.companies?.name || userProfile.company_name || 'N/A'}</TableCell>
                  <TableCell>{userProfile.phone || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge className={getRoleColor(userProfile.role)}>
                        {getRoleText(userProfile.role)}
                      </Badge>
                      {(userProfile.role === 'motorista' || userProfile.role === 'driver') && driversPermissionsMap[userProfile.user_id] && (
                        <>
                          {driversPermissionsMap[userProfile.user_id].can_start_journey && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5">
                              <Play className="h-2.5 w-2.5" /> Iniciar
                            </Badge>
                          )}
                          {driversPermissionsMap[userProfile.user_id].can_auto_close_journey && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Encerrar
                            </Badge>
                          )}
                          {driversPermissionsMap[userProfile.user_id].can_add_revenue && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5">
                              <DollarSign className="h-2.5 w-2.5" /> Receitas
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <span className="text-sm">{formatDate(userProfile.created_at)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(userProfile)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      {userProfile.role === 'gestor' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setGestorPermissionsTarget({
                              userId: userProfile.user_id,
                              userName: userProfile.full_name || userProfile.email,
                              companyId: userProfile.companies?.name ? (currentCompany?.id || '') : '',
                            });
                            setGestorPermissionsDialogOpen(true);
                          }}
                          title="Configurar permissoes do gestor"
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                      )}
                      {userProfile?.role !== 'master' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setUserToLink({
                              id: userProfile.id,
                              name: userProfile.full_name || userProfile.email,
                              companyId: userProfile.companies?.name ? userProfile.id : undefined
                            });
                            setCompanyLinkDialogOpen(true);
                          }}
                          title="Vincular à empresa"
                        >
                          <Link className="h-3 w-3" />
                        </Button>
                      )}
                      {userProfile.user_id !== user?.id && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleResetPassword(userProfile)}
                          title="Resetar senha"
                          disabled={!hasPermission('manage_users')}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDelete(userProfile.id)}
                        disabled={userProfile.id === user?.id}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Company Link Dialog */}
      {userToLink && (
        <CompanyLinkDialog
          open={companyLinkDialogOpen}
          onOpenChange={setCompanyLinkDialogOpen}
          userId={userToLink.id}
          userName={userToLink.name}
          currentCompanyId={userToLink.companyId}
          onSuccess={() => {
            fetchUsers();
            setUserToLink(null);
          }}
        />
      )}

      {/* Gestor Permissions Dialog */}
      {gestorPermissionsTarget && (
        <GestorPermissionsDialog
          open={gestorPermissionsDialogOpen}
          onOpenChange={(open) => {
            setGestorPermissionsDialogOpen(open);
            if (!open) setGestorPermissionsTarget(null);
          }}
          userId={gestorPermissionsTarget.userId}
          userName={gestorPermissionsTarget.userName}
          companyId={gestorPermissionsTarget.companyId}
        />
      )}

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Senha Resetada</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium mb-2">
                ✅ Senha resetada com sucesso!
              </p>
              <p className="text-green-700 text-sm">
                Uma nova senha temporária foi gerada para <strong>{userToResetPassword?.name}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha Temporária</Label>
              <div className="flex space-x-2">
                <Input
                  id="newPassword"
                  value={newTemporaryPassword}
                  readOnly
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(newTemporaryPassword);
                    toast({
                      title: "Copiado!",
                      description: "Senha copiada para a área de transferência."
                    });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">📧 Notificação por Email</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• Um email foi enviado para <strong>{userToResetPassword?.email}</strong></p>
                <p>• O email contém a nova senha temporária</p>
                <p>• No próximo login será obrigatório alterar a senha</p>
                <p>• Compartilhe a senha acima se necessário</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={() => {
                  setResetPasswordDialogOpen(false);
                  setUserToResetPassword(null);
                  setNewTemporaryPassword('');
                }}
                className="bg-gradient-primary"
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}