import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CreateCompanyDialog from "@/components/master/CreateCompanyDialog";
import EditCompanyDialog from "@/components/master/EditCompanyDialog";
import CreateSubscriptionDialog from "@/components/master/CreateSubscriptionDialog";
import PaymentStatusBadge from "@/components/master/PaymentStatusBadge";
import { Plus, Search, Building2, Edit, MoreHorizontal, CreditCard, ExternalLink, AlertTriangle } from "lucide-react";
import { formatDateBR } from "@/lib/utils";

interface Company {
  id: string;
  name: string;
  cnpj: string;
  status: string;
  created_at: string;
  responsible_name: string;
  responsible_cpf: string;
  address: string;
  city?: string;
  state?: string;
  zip_code?: string;
  email?: string;
  phone?: string;
  subscription_plan_id?: string;
  subscription_status?: string;
  asaas_customer_id?: string;
  asaas_subscription_id?: string;
  next_billing_date?: string;
  subscription_plan?: {
    name: string;
    vehicle_limit: number;
    monthly_price: number;
    price_per_vehicle?: number;
  };
  vehicle_count?: number;
  vehicle_limit?: number;
}

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('companies')
        .select(`
          *,
          subscription_plan:subscription_plans(name, vehicle_limit, monthly_price, price_per_vehicle)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Get vehicle count for each company
      const companiesWithCounts = await Promise.all(
        (data || []).map(async (company) => {
          const { count } = await supabase
            .from('vehicles')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id);
          
          return {
            ...company,
            vehicle_count: count || 0
          };
        })
      );

      setCompanies(companiesWithCounts);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar empresas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter companies based on search and tab
  const filteredCompanies = companies.filter(company => {
    const matchesSearch = 
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.cnpj.includes(searchTerm) ||
      company.responsible_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = 
      (activeTab === 'active' && company.status === 'active') ||
      (activeTab === 'suspended' && company.status === 'suspended') ||
      (activeTab === 'all');

    return matchesSearch && matchesTab;
  });

  const activeCount = companies.filter(c => c.status === 'active').length;
  const suspendedCount = companies.filter(c => c.status === 'suspended').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Ativo</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspenso</Badge>;
      case 'inactive':
        return <Badge variant="outline">Inativo</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return formatDateBR(dateString);
  };

  const handleEdit = (company: Company) => {
    setSelectedCompany(company);
    setEditDialogOpen(true);
  };

  const handleOpenSubscription = (company: Company) => {
    setSelectedCompany(company);
    setSubscriptionDialogOpen(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando empresas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Empresas</h1>
          <p className="text-muted-foreground">Gerencie todas as empresas cadastradas</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{companies.length}</div>
            <p className="text-sm text-muted-foreground">Total de Empresas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
            <p className="text-sm text-muted-foreground">Ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-destructive">{suspendedCount}</div>
            <p className="text-sm text-muted-foreground">Suspensas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Empresas Cadastradas
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por empresa, CNPJ ou responsável..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
              <TabsList>
                <TabsTrigger value="active">
                  Ativas ({activeCount})
                </TabsTrigger>
                <TabsTrigger value="suspended" className="text-destructive">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Suspensas ({suspendedCount})
                </TabsTrigger>
                <TabsTrigger value="all">
                  Todas ({companies.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Placas</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>{company.cnpj}</TableCell>
                  <TableCell>{company.responsible_name}</TableCell>
                  <TableCell>
                    {company.subscription_plan ? (
                      <div className="text-sm">
                        <div className="font-medium">{company.subscription_plan.name}</div>
                        <div className="text-muted-foreground">
                          R$ {company.subscription_plan.monthly_price.toFixed(2)}/mês
                        </div>
                      </div>
                    ) : (
                      <Badge variant="outline">Sem plano</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const count = company.vehicle_count || 0;
                      const limit = company.vehicle_limit || 5;
                      const isUnlimited = limit === 999;
                      const isAtLimit = !isUnlimited && count >= limit;
                      const percentage = isUnlimited ? 0 : Math.min(100, (count / limit) * 100);
                      
                      return (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{count}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-muted-foreground">
                              {isUnlimited ? "∞" : limit}
                            </span>
                            {isAtLimit && (
                              <Badge variant="destructive" className="ml-1 text-xs">Limite</Badge>
                            )}
                          </div>
                          {!isUnlimited && (
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full ${isAtLimit ? "bg-destructive" : "bg-primary"}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge 
                      status={company.subscription_status} 
                      hasSubscription={!!company.asaas_subscription_id}
                    />
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(company.status)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(company)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenSubscription(company)}>
                          <CreditCard className="h-4 w-4 mr-2" />
                          {company.asaas_subscription_id ? 'Gerar Cobrança' : 'Criar Assinatura'}
                        </DropdownMenuItem>
                        {company.asaas_customer_id && (
                          <DropdownMenuItem asChild>
                            <a 
                              href={`https://www.asaas.com/customerDetails/${company.asaas_customer_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Ver no Asaas
                            </a>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredCompanies.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm ? 'Nenhuma empresa encontrada com os filtros aplicados.' : 'Nenhuma empresa cadastrada.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateCompanyDialog 
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchCompanies}
      />

      <EditCompanyDialog 
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchCompanies}
        company={selectedCompany}
      />

      <CreateSubscriptionDialog 
        open={subscriptionDialogOpen}
        onOpenChange={setSubscriptionDialogOpen}
        company={selectedCompany}
        onSuccess={fetchCompanies}
      />
    </div>
  );
}
