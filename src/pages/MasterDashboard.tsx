import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Search, Building2, DollarSign, Eye, Settings2, AlertCircle, Truck, CreditCard, Calendar } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CompanyDetails } from "@/components/master/CompanyDetails";

interface Company {
  id: string;
  name: string;
  cnpj: string;
  status: string;
  created_at: string;
  responsible_name: string;
  email?: string;
  phone?: string;
  subscription_plan?: {
    name: string;
    vehicle_limit: number;
    monthly_price: number;
    price_per_vehicle: number;
  };
  vehicle_limit?: number;
  subscription_status?: string;
  next_billing_date?: string;
  contracted_price_per_vehicle?: number;
}

interface CompanyStats {
  vehicle_count: number;
  last_activity: string;
}

interface MasterStats {
  active_companies: number;
  suspended_companies: number;
  new_companies_30d: number;
  active_vehicles: number;
  mrr_total: number;
  overdue_companies: number;
}

export default function MasterDashboard() {
  const { toast } = useToast();
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesStats, setCompaniesStats] = useState<Record<string, CompanyStats>>({});
  const [detailsCompanyId, setDetailsCompanyId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [masterStats, setMasterStats] = useState<MasterStats>({
    active_companies: 0,
    suspended_companies: 0,
    new_companies_30d: 0,
    active_vehicles: 0,
    mrr_total: 0,
    overdue_companies: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    try {
      setLoading(true);
      
      // Fetch companies with plan data
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select(`
          *,
          subscription_plan:subscription_plans(name, vehicle_limit, monthly_price, price_per_vehicle)
        `)
        .order('created_at', { ascending: false });

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

      if (companiesData && companiesData.length > 0) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Fetch vehicles and journeys for stats
        const [vehiclesRes, journeysRes] = await Promise.all([
          supabase.from('vehicles').select('id, company_id, status'),
          supabase.from('journeys').select('company_id, updated_at').order('updated_at', { ascending: false })
        ]);

        // Aggregate data by company
        const stats: Record<string, CompanyStats> = {};
        
        for (const company of companiesData) {
          const companyVehicles = vehiclesRes.data?.filter(v => v.company_id === company.id) || [];
          const companyJourneys = journeysRes.data?.filter(j => j.company_id === company.id) || [];

          stats[company.id] = {
            vehicle_count: companyVehicles.length,
            last_activity: companyJourneys[0]?.updated_at || company.created_at,
          };
        }
        
        setCompaniesStats(stats);

        // Calculate master stats
        const activeCompanies = companiesData.filter(c => c.status === 'active').length;
        const suspendedCompanies = companiesData.filter(c => c.status === 'suspended').length;
        const newCompanies = companiesData.filter(c => 
          new Date(c.created_at) >= thirtyDaysAgo
        ).length;

        const allVehicles = vehiclesRes.data || [];
        const activeVehicles = allVehicles.filter(v => v.status === 'active').length;

        // Calculate MRR from active subscriptions (price per vehicle * contracted vehicles)
        // Priority: contracted_price_per_vehicle > plan price
        const mrrTotal = companiesData
          .filter(c => c.subscription_status === 'active' && (c.contracted_price_per_vehicle || c.subscription_plan))
          .reduce((sum, c) => {
            const pricePerVehicle = c.contracted_price_per_vehicle 
              || c.subscription_plan?.price_per_vehicle 
              || c.subscription_plan?.monthly_price 
              || 0;
            const vehicleLimit = c.vehicle_limit || 1;
            return sum + (pricePerVehicle * vehicleLimit);
          }, 0);

        // Count overdue companies (subscription not active but company active)
        const overdueCompanies = companiesData.filter(c => 
          c.status === 'active' && c.subscription_status !== 'active'
        ).length;

        setMasterStats({
          active_companies: activeCompanies,
          suspended_companies: suspendedCompanies,
          new_companies_30d: newCompanies,
          active_vehicles: activeVehicles,
          mrr_total: mrrTotal,
          overdue_companies: overdueCompanies,
        });
      }
    } catch (error) {
      console.error('Error fetching master data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do painel master",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCompanyStatus = async (company: Company) => {
    try {
      const newStatus = company.status === 'active' ? 'suspended' : 'active';
      
      const { error } = await supabase
        .from('companies')
        .update({ status: newStatus })
        .eq('id', company.id);

      if (error) throw error;

      toast({
        title: "Status Atualizado",
        description: `Empresa ${newStatus === 'active' ? 'ativada' : 'suspensa'} com sucesso`,
      });

      fetchMasterData();
      
    } catch (error) {
      console.error('Error updating company status:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da empresa",
        variant: "destructive"
      });
    }
  };

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = 
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.cnpj.includes(searchTerm) ||
      company.responsible_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || company.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getPaymentStatusBadge = (company: Company) => {
    if (company.subscription_status === 'active') {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Pago</Badge>;
    }
    if (company.subscription_status === 'pending') {
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pendente</Badge>;
    }
    if (company.subscription_status === 'overdue') {
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Atrasado</Badge>;
    }
    return <Badge variant="secondary">Sem Assinatura</Badge>;
  };

  const getVehicleUsageProgress = (company: Company, vehicleCount: number) => {
    const limit = company.vehicle_limit || company.subscription_plan?.vehicle_limit || 10;
    const percentage = Math.min((vehicleCount / limit) * 100, 100);
    const isNearLimit = percentage >= 80;
    const isAtLimit = percentage >= 100;
    
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className={isAtLimit ? 'text-red-600 font-medium' : isNearLimit ? 'text-yellow-600' : ''}>
            {vehicleCount}/{limit}
          </span>
        </div>
        <Progress 
          value={percentage} 
          className={`h-2 ${isAtLimit ? '[&>div]:bg-red-500' : isNearLimit ? '[&>div]:bg-yellow-500' : ''}`}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-lg">Carregando painel master...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Frota Link Admin</h1>
            <p className="text-muted-foreground">Painel de Administração Master</p>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            Master Admin
          </Badge>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* KPI Cards - Focused on SaaS metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MRR Total</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {masterStats.mrr_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Receita recorrente mensal
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Empresas Ativas</CardTitle>
              <Building2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{masterStats.active_companies}</div>
              <p className="text-xs text-muted-foreground">
                +{masterStats.new_companies_30d} nos últimos 30 dias
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Empresas Suspensas</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{masterStats.suspended_companies}</div>
              <p className="text-xs text-muted-foreground">
                Requerem atenção
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inadimplentes</CardTitle>
              <CreditCard className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{masterStats.overdue_companies}</div>
              <p className="text-xs text-muted-foreground">
                Pagamento pendente
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Placas Ativas</CardTitle>
              <Truck className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{masterStats.active_vehicles}</div>
              <p className="text-xs text-muted-foreground">
                Veículos em operação
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Empresas</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companies.length}</div>
              <p className="text-xs text-muted-foreground">
                Na plataforma
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Gestão de Empresas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por empresa, CNPJ ou responsável..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Companies Table - Optimized for SaaS management */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="w-32">Placas</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Próx. Cobrança</TableHead>
                    <TableHead>Últ. Atividade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company) => {
                    const stats = companiesStats[company.id];
                    const vehicleCount = stats?.vehicle_count || 0;
                    
                    return (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{company.cnpj}</TableCell>
                        <TableCell>{company.responsible_name}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant="outline">
                              {company.subscription_plan?.name || 'Sem Plano'}
                            </Badge>
                            {(company.subscription_plan || company.contracted_price_per_vehicle) && company.vehicle_limit && (
                              <div className="text-sm font-medium text-muted-foreground">
                                R$ {((company.contracted_price_per_vehicle || company.subscription_plan?.price_per_vehicle || company.subscription_plan?.monthly_price || 0) * company.vehicle_limit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getVehicleUsageProgress(company, vehicleCount)}
                        </TableCell>
                        <TableCell>
                          {getPaymentStatusBadge(company)}
                        </TableCell>
                        <TableCell>
                          {company.next_billing_date ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(company.next_billing_date), 'dd/MM/yyyy', { locale: ptBR })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {stats?.last_activity ? (
                              formatDistanceToNow(new Date(stats.last_activity), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })
                            ) : '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            company.status === 'active' ? 'default' : 
                            company.status === 'suspended' ? 'destructive' : 'secondary'
                          }>
                            {company.status === 'active' ? 'Ativo' :
                             company.status === 'suspended' ? 'Suspenso' : 'Cancelado'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setDetailsCompanyId(company.id);
                                setDetailsOpen(true);
                              }}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost" 
                              size="sm"
                              onClick={() => toggleCompanyStatus(company)}
                              title={company.status === 'active' ? 'Suspender empresa' : 'Ativar empresa'}
                            >
                              {company.status === 'active' ? 
                                <AlertCircle className="h-4 w-4 text-destructive" /> :
                                <Settings2 className="h-4 w-4 text-green-600" />
                              }
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <CompanyDetails
        companyId={detailsCompanyId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}
