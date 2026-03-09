import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreateUserDialog } from "@/components/users/CreateUserDialog";
import { EditUserDialog } from "@/components/users/EditUserDialog";
import { ResetPasswordDialog } from "@/components/users/ResetPasswordDialog";
import { 
  Users, UserPlus, Search, Building2, Shield, Wrench, Trash2, Edit, Crown, Copy, Calendar, 
  MoreVertical, Plus, Key, UserX, UserCheck, Loader2 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StaffUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: 'bpo' | 'suporte';
  created_at: string;
  company_count?: number;
}

interface Company {
  id: string;
  name: string;
  cnpj: string;
  status: string;
  subscription_plan?: {
    name: string;
  };
}

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_values: any;
  new_values: any;
  created_at: string;
  company_id?: string;
}

interface AllUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  company_name: string;
  created_at: string;
  status: string;
}

const ITEMS_PER_PAGE = 10;

export default function TeamManagement() {
  const { toast } = useToast();
  const { hasPermission } = useMultiTenant();
  const [activeTab, setActiveTab] = useState("team");
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  
  // Dialog states for staff
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedStaffUser, setSelectedStaffUser] = useState<StaffUser | null>(null);
  
  // Form states for staff
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<'bpo' | 'suporte'>('bpo');
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [filterConcierge, setFilterConcierge] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Password dialog states
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [createdUserName, setCreatedUserName] = useState("");
  const [createdUserEmail, setCreatedUserEmail] = useState("");

  // ========== States for All Users Tab ==========
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [filteredAllUsers, setFilteredAllUsers] = useState<AllUser[]>([]);
  const [allUsersSearch, setAllUsersSearch] = useState("");
  const [allUsersLoading, setAllUsersLoading] = useState(true);
  const [allUsersCurrentPage, setAllUsersCurrentPage] = useState(1);
  const [allUsersSelectedTab, setAllUsersSelectedTab] = useState("all");
  
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [selectedAllUser, setSelectedAllUser] = useState<AllUser | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === "users" && hasPermission("master")) {
      fetchAllUsers();
    }
  }, [activeTab, hasPermission]);

  useEffect(() => {
    filterAllUsers();
  }, [allUsersSearch, allUsers, allUsersSelectedTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchStaffUsers(),
        fetchCompanies(),
        fetchAuditLogs(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffUsers = async () => {
    try {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at')
        .in('role', ['bpo', 'suporte']);

      if (rolesError) throw rolesError;

      const userIds = roles?.map(r => r.user_id) || [];
      
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, email, full_name')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;

        const { data: bpoAccess } = await supabase
          .from('bpo_company_access')
          .select('bpo_user_id')
          .is('revoked_at', null);

        const accessCounts: Record<string, number> = {};
        bpoAccess?.forEach(a => {
          accessCounts[a.bpo_user_id] = (accessCounts[a.bpo_user_id] || 0) + 1;
        });

        const staffData: StaffUser[] = (roles || []).map(role => {
          const profile = profiles?.find(p => p.user_id === role.user_id);
          return {
            id: role.user_id,
            user_id: role.user_id,
            email: profile?.email || '',
            full_name: profile?.full_name || '',
            role: role.role as 'bpo' | 'suporte',
            created_at: role.created_at,
            company_count: accessCounts[role.user_id] || 0
          };
        });

        setStaffUsers(staffData);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          cnpj,
          status,
          subscription_plan:subscription_plans (name)
        `)
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  };

  // ========== All Users Functions ==========
  const fetchAllUsers = async () => {
    setAllUsersLoading(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id,
          user_id,
          full_name,
          email,
          role,
          company_name,
          created_at,
          status
        `)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const rolesMap = new Map(
        rolesData?.map(r => [r.user_id, r.role]) || []
      );

      const usersWithRoles = (profilesData || []).map(profile => ({
        ...profile,
        role: rolesMap.get(profile.user_id) || profile.role
      }));

      setAllUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar usuários",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAllUsersLoading(false);
    }
  };

  const filterAllUsers = () => {
    let filtered = allUsers;

    if (allUsersSelectedTab === "master") {
      filtered = filtered.filter((user) => user.role === "master");
    } else if (allUsersSelectedTab === "clients") {
      filtered = filtered.filter((user) => user.role !== "master");
    }

    if (allUsersSearch) {
      filtered = filtered.filter(
        (user) =>
          user.full_name?.toLowerCase().includes(allUsersSearch.toLowerCase()) ||
          user.email?.toLowerCase().includes(allUsersSearch.toLowerCase()) ||
          user.company_name?.toLowerCase().includes(allUsersSearch.toLowerCase())
      );
    }

    setFilteredAllUsers(filtered);
    setAllUsersCurrentPage(1);
  };

  const handleDeactivateUser = async () => {
    if (!selectedAllUser) return;

    try {
      const newStatus = selectedAllUser.status === "active" ? "inactive" : "active";
      
      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("user_id", selectedAllUser.user_id);

      if (error) throw error;

      toast({
        title: newStatus === "inactive" ? "Usuário desativado" : "Usuário ativado",
        description: "Status atualizado com sucesso",
      });

      fetchAllUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeactivateDialogOpen(false);
      setSelectedAllUser(null);
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
      master: { variant: "default", label: "Master" },
      admin: { variant: "default", label: "Admin" },
      gestor: { variant: "secondary", label: "Gestor" },
      motorista: { variant: "outline", label: "Motorista" },
    };
    return <Badge variant={variants[role]?.variant || "outline"}>{variants[role]?.label || role}</Badge>;
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString("pt-BR");

  const allUsersTotalPages = Math.ceil(filteredAllUsers.length / ITEMS_PER_PAGE);
  const paginatedAllUsers = filteredAllUsers.slice(
    (allUsersCurrentPage - 1) * ITEMS_PER_PAGE,
    allUsersCurrentPage * ITEMS_PER_PAGE
  );

  // ========== Staff User Functions ==========
  const handleCreateStaffUser = async () => {
    if (!formEmail || !formName) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha email e nome",
        variant: "destructive"
      });
      return;
    }

    if (formRole === 'bpo' && selectedCompanies.length === 0) {
      toast({
        title: "Empresas obrigatórias",
        description: "Selecione pelo menos uma empresa para o usuário BPO",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: formEmail,
          full_name: formName,
          role: formRole,
          send_credentials: true
        }
      });

      if (error) throw error;

      const userId = data.user_id;

      if (formRole === 'bpo' && selectedCompanies.length > 0) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        const accessRecords = selectedCompanies.map(companyId => ({
          bpo_user_id: userId,
          company_id: companyId,
          granted_by: currentUser?.id
        }));

        const { error: accessError } = await supabase
          .from('bpo_company_access')
          .insert(accessRecords);

        if (accessError) throw accessError;
      }

      setCreatedPassword(data.temporary_password);
      setCreatedUserName(formName);
      setCreatedUserEmail(formEmail);
      setIsCreateDialogOpen(false);
      setShowPasswordDialog(true);
      
      toast({
        title: "Usuário criado com sucesso",
        description: `${formName} foi adicionado como ${formRole.toUpperCase()}`
      });

      fetchData();

    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: "Erro ao criar usuário",
        description: error.message || "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditStaffUser = async () => {
    if (!selectedStaffUser) return;

    if (formRole === 'bpo' && selectedCompanies.length === 0) {
      toast({
        title: "Empresas obrigatórias",
        description: "Selecione pelo menos uma empresa para o usuário BPO",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (formRole === 'bpo') {
        const { data: currentAccess } = await supabase
          .from('bpo_company_access')
          .select('company_id')
          .eq('bpo_user_id', selectedStaffUser.user_id)
          .is('revoked_at', null);

        const currentCompanyIds = currentAccess?.map(a => a.company_id) || [];

        const toAdd = selectedCompanies.filter(id => !currentCompanyIds.includes(id));
        const toRevoke = currentCompanyIds.filter(id => !selectedCompanies.includes(id));

        if (toAdd.length > 0) {
          for (const companyId of toAdd) {
            const { error: upsertError } = await supabase
              .from('bpo_company_access')
              .upsert({
                bpo_user_id: selectedStaffUser.user_id,
                company_id: companyId,
                granted_by: currentUser?.id,
                granted_at: new Date().toISOString(),
                revoked_at: null,
                updated_at: new Date().toISOString()
              }, { 
                onConflict: 'bpo_user_id,company_id',
                ignoreDuplicates: false 
              });

            if (upsertError) throw upsertError;
          }
        }

        if (toRevoke.length > 0) {
          const { error: revokeError } = await supabase
            .from('bpo_company_access')
            .update({ revoked_at: new Date().toISOString() })
            .eq('bpo_user_id', selectedStaffUser.user_id)
            .in('company_id', toRevoke)
            .is('revoked_at', null);

          if (revokeError) throw revokeError;
        }
      }

      toast({
        title: "Usuário atualizado",
        description: "Permissões atualizadas com sucesso"
      });

      setIsEditDialogOpen(false);
      resetStaffForm();
      fetchData();

    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenStaffEdit = async (user: StaffUser) => {
    setSelectedStaffUser(user);
    setFormEmail(user.email);
    setFormName(user.full_name);
    setFormRole(user.role);

    if (user.role === 'bpo') {
      const { data } = await supabase
        .from('bpo_company_access')
        .select('company_id')
        .eq('bpo_user_id', user.user_id)
        .is('revoked_at', null);

      setSelectedCompanies(data?.map(a => a.company_id) || []);
    } else {
      setSelectedCompanies([]);
    }

    setIsEditDialogOpen(true);
  };

  const handleDeleteStaffUser = async (user: StaffUser) => {
    if (!confirm(`Remover ${user.full_name} da equipe?`)) return;

    try {
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user.user_id)
        .eq('role', user.role);

      if (user.role === 'bpo') {
        await supabase
          .from('bpo_company_access')
          .update({ revoked_at: new Date().toISOString() })
          .eq('bpo_user_id', user.user_id)
          .is('revoked_at', null);
      }

      toast({
        title: "Usuário removido",
        description: `${user.full_name} foi removido da equipe`
      });

      fetchData();

    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Erro ao remover",
        description: "Tente novamente",
        variant: "destructive"
      });
    }
  };

  const resetStaffForm = () => {
    setFormEmail("");
    setFormName("");
    setFormRole('bpo');
    setSelectedCompanies([]);
    setSelectedStaffUser(null);
    setFilterConcierge(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Texto copiado para a área de transferência"
    });
  };

  const handleClosePasswordDialog = () => {
    setShowPasswordDialog(false);
    setCreatedPassword(null);
    setCreatedUserName("");
    setCreatedUserEmail("");
    resetStaffForm();
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'impersonation_start':
        return <Badge variant="destructive">Impersonação Iniciada</Badge>;
      case 'impersonation_end':
        return <Badge variant="outline">Impersonação Finalizada</Badge>;
      case 'status_change':
        return <Badge variant="default">Mudança de Status</Badge>;
      case 'role_change':
        return <Badge variant="secondary">Mudança de Papel</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  // Filter staff users
  const filteredStaffUsers = staffUsers.filter(user => {
    const matchesSearch = 
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = 
      teamFilter === 'all' || 
      user.role === teamFilter;
    
    return matchesSearch && matchesTab;
  });

  // Filter companies for selection
  const filteredCompanies = companies.filter(company => {
    if (filterConcierge) {
      return company.subscription_plan?.name === 'Concierge';
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipe & Acessos</h1>
          <p className="text-muted-foreground">Gerencie usuários internos, permissões e auditoria</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="team">Equipe Interna</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Equipe</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{staffUsers.length}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuários BPO</CardTitle>
                <Shield className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {staffUsers.filter(u => u.role === 'bpo').length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuários Suporte</CardTitle>
                <Wrench className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {staffUsers.filter(u => u.role === 'suporte').length}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Membros da Equipe</CardTitle>
              <CardDescription>
                Gerencie permissões e acesso de usuários internos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={teamFilter} onValueChange={setTeamFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filtrar por tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="bpo">BPO</SelectItem>
                      <SelectItem value="suporte">Suporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Empresas</TableHead>
                      <TableHead>Desde</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaffUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Nenhum usuário encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStaffUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {user.role === 'bpo' ? (
                              <Badge className="bg-primary/10 text-primary border-primary/20">
                                <Shield className="h-3 w-3 mr-1" />
                                BPO
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                <Wrench className="h-3 w-3 mr-1" />
                                Suporte
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.role === 'bpo' && (
                              <Badge variant="secondary">{user.company_count} empresas</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleOpenStaffEdit(user)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDeleteStaffUser(user)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => setCreateUserDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </div>

          {allUsersLoading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              <Tabs value={allUsersSelectedTab} onValueChange={setAllUsersSelectedTab}>
                <TabsList>
                  <TabsTrigger value="all">Todos ({allUsers.length})</TabsTrigger>
                  <TabsTrigger value="master">
                    Master ({allUsers.filter((u) => u.role === "master").length})
                  </TabsTrigger>
                  <TabsTrigger value="clients">
                    Clientes ({allUsers.filter((u) => u.role !== "master").length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={allUsersSelectedTab} className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Lista de Usuários ({filteredAllUsers.length})</CardTitle>
                      <Input
                        placeholder="Buscar por nome, e-mail ou empresa..."
                        value={allUsersSearch}
                        onChange={(e) => setAllUsersSearch(e.target.value)}
                        className="max-w-sm"
                      />
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>E-mail</TableHead>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Função</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Cadastrado em</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedAllUsers.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground">
                                Nenhum usuário encontrado
                              </TableCell>
                            </TableRow>
                          ) : (
                            paginatedAllUsers.map((user) => (
                              <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.full_name || "-"}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>{user.company_name || "-"}</TableCell>
                                <TableCell>{getRoleBadge(user.role)}</TableCell>
                                <TableCell>
                                  <Badge variant={user.status === "active" ? "default" : "outline"}>
                                    {user.status === "active" ? "Ativo" : "Inativo"}
                                  </Badge>
                                </TableCell>
                                <TableCell>{formatDate(user.created_at)}</TableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelectedAllUser(user);
                                          setEditUserDialogOpen(true);
                                        }}
                                      >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Editar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelectedAllUser(user);
                                          setResetPasswordDialogOpen(true);
                                        }}
                                      >
                                        <Key className="h-4 w-4 mr-2" />
                                        Redefinir Senha
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelectedAllUser(user);
                                          setDeactivateDialogOpen(true);
                                        }}
                                      >
                                        {user.status === "active" ? (
                                          <>
                                            <UserX className="h-4 w-4 mr-2" />
                                            Desativar
                                          </>
                                        ) : (
                                          <>
                                            <UserCheck className="h-4 w-4 mr-2" />
                                            Ativar
                                          </>
                                        )}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>

                      {allUsersTotalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                          <p className="text-sm text-muted-foreground">
                            Mostrando {(allUsersCurrentPage - 1) * ITEMS_PER_PAGE + 1} -{" "}
                            {Math.min(allUsersCurrentPage * ITEMS_PER_PAGE, filteredAllUsers.length)} de{" "}
                            {filteredAllUsers.length}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAllUsersCurrentPage((p) => Math.max(1, p - 1))}
                              disabled={allUsersCurrentPage === 1}
                            >
                              Anterior
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAllUsersCurrentPage((p) => Math.min(allUsersTotalPages, p + 1))}
                              disabled={allUsersCurrentPage === allUsersTotalPages}
                            >
                              Próxima
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Logs de Auditoria
              </CardTitle>
              <CardDescription>
                Atividades e ações realizadas no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum log de auditoria encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {log.user_id === 'master-user' ? 'Master Admin' : log.user_id.slice(0, 8)}
                          </Badge>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell className="font-mono text-sm">{log.table_name || 'N/A'}</TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate">
                            {log.new_values && (
                              <span className="text-sm text-muted-foreground">
                                {JSON.stringify(log.new_values).slice(0, 50)}...
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Staff User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Usuário da Equipe</DialogTitle>
            <DialogDescription>
              Adicione um novo usuário BPO ou Suporte à equipe
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nome do usuário"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Usuário</Label>
              <Select value={formRole} onValueChange={(v) => setFormRole(v as 'bpo' | 'suporte')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bpo">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      BPO - Acesso a empresas específicas
                    </div>
                  </SelectItem>
                  <SelectItem value="suporte">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Suporte - Acesso de visualização
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formRole === 'bpo' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Empresas com Acesso</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="filter-concierge"
                      checked={filterConcierge}
                      onCheckedChange={(checked) => setFilterConcierge(!!checked)}
                    />
                    <label htmlFor="filter-concierge" className="text-sm text-muted-foreground">
                      Apenas Concierge
                    </label>
                  </div>
                </div>
                <ScrollArea className="h-48 border rounded-md p-2">
                  <div className="space-y-2">
                    {filteredCompanies.map(company => (
                      <div key={company.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={company.id}
                          checked={selectedCompanies.includes(company.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCompanies(prev => [...prev, company.id]);
                            } else {
                              setSelectedCompanies(prev => prev.filter(id => id !== company.id));
                            }
                          }}
                        />
                        <label htmlFor={company.id} className="text-sm flex items-center gap-2">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {company.name}
                          {company.subscription_plan && (
                            <Badge variant="outline" className="text-xs">
                              {company.subscription_plan.name}
                            </Badge>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <p className="text-sm text-muted-foreground">
                  {selectedCompanies.length} empresa(s) selecionada(s)
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetStaffForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreateStaffUser} disabled={isSubmitting}>
              {isSubmitting ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as permissões e acessos do usuário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={formName} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={formEmail} disabled className="bg-muted" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input 
                value={formRole === 'bpo' ? 'BPO' : 'Suporte'} 
                disabled 
                className="bg-muted" 
              />
            </div>

            {formRole === 'bpo' && (
              <div className="space-y-2">
                <Label>Empresas com Acesso</Label>
                <ScrollArea className="h-48 border rounded-md p-2">
                  <div className="space-y-2">
                    {companies.map(company => (
                      <div key={company.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-${company.id}`}
                          checked={selectedCompanies.includes(company.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCompanies(prev => [...prev, company.id]);
                            } else {
                              setSelectedCompanies(prev => prev.filter(id => id !== company.id));
                            }
                          }}
                        />
                        <label htmlFor={`edit-${company.id}`} className="text-sm flex items-center gap-2">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {company.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); resetStaffForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleEditStaffUser} disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={handleClosePasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Usuário Criado com Sucesso!
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-muted-foreground">
              As credenciais foram enviadas por email. Anote a senha temporária:
            </p>
            
            <div className="space-y-2">
              <Label>Nome</Label>
              <div className="p-2 bg-muted rounded-md">{createdUserName}</div>
            </div>
            
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="p-2 bg-muted rounded-md flex justify-between items-center">
                {createdUserEmail}
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(createdUserEmail)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Senha Temporária</Label>
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-md flex justify-between items-center">
                <code className="text-amber-700 font-mono">{createdPassword}</code>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(createdPassword || '')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleClosePasswordDialog}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== All Users Dialogs ========== */}
      <CreateUserDialog
        open={createUserDialogOpen}
        onOpenChange={setCreateUserDialogOpen}
        onSuccess={fetchAllUsers}
      />

      <EditUserDialog
        open={editUserDialogOpen}
        onOpenChange={setEditUserDialogOpen}
        userId={selectedAllUser?.user_id || null}
        onSuccess={fetchAllUsers}
      />

      <ResetPasswordDialog
        open={resetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
        userId={selectedAllUser?.user_id || null}
        userEmail={selectedAllUser?.email || ""}
        userName={selectedAllUser?.full_name || ""}
      />

      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedAllUser?.status === "active" ? "Desativar" : "Ativar"} Usuário
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja {selectedAllUser?.status === "active" ? "desativar" : "ativar"}{" "}
              <strong>{selectedAllUser?.full_name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivateUser}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
