import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Activity, Database, Users, TrendingUp, CheckCircle, AlertCircle, XCircle, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Usage Data Interface
interface UsageData {
  company_name: string;
  module: string;
  action_count: number;
}

// Performance Stats Interface
interface PerformanceStats {
  totalCompanies: number;
  totalUsers: number;
  totalRecords: number;
  activeRate: number;
  totalJourneys: number;
  totalVehicles: number;
}

// Company Health Interface
interface CompanyHealth {
  id: string;
  name: string;
  status: string;
  subscription_status: string | null;
  health_score: number;
  last_activity: string;
  vehicle_count: number;
  journey_count: number;
}

export default function UsageReport() {
  const [activeTab, setActiveTab] = useState("usage");
  const [usage, setUsage] = useState<UsageData[]>([]);
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats>({
    totalCompanies: 0,
    totalUsers: 0,
    totalRecords: 0,
    activeRate: 0,
    totalJourneys: 0,
    totalVehicles: 0,
  });
  const [companiesHealth, setCompaniesHealth] = useState<CompanyHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchUsageData(),
        fetchPerformanceData(),
        fetchHealthData(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageData = async () => {
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select(`
          action,
          table_name,
          company_id,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      // Get company names
      const companyIds = [...new Set(data?.filter(d => d.company_id).map(d => d.company_id))] as string[];
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds.length > 0 ? companyIds : ['00000000-0000-0000-0000-000000000000']);

      const companyMap: Record<string, string> = {};
      companies?.forEach(c => {
        companyMap[c.id] = c.name;
      });

      // Aggregate data by company and module
      const aggregated: Record<string, Record<string, number>> = {};
      
      data?.forEach((log: any) => {
        const companyName = log.company_id ? (companyMap[log.company_id] || "Desconhecido") : "Sistema";
        const module = log.table_name || log.action || "Geral";
        
        if (!aggregated[companyName]) {
          aggregated[companyName] = {};
        }
        
        if (!aggregated[companyName][module]) {
          aggregated[companyName][module] = 0;
        }
        
        aggregated[companyName][module]++;
      });

      const formatted: UsageData[] = [];
      Object.keys(aggregated).forEach((company) => {
        Object.keys(aggregated[company]).forEach((module) => {
          formatted.push({
            company_name: company,
            module: module,
            action_count: aggregated[company][module],
          });
        });
      });

      // Sort by action count
      formatted.sort((a, b) => b.action_count - a.action_count);
      setUsage(formatted.slice(0, 100));
    } catch (error: any) {
      console.error('Error fetching usage:', error);
    }
  };

  const fetchPerformanceData = async () => {
    try {
      const [companies, profiles, journeys, vehicles] = await Promise.all([
        supabase.from("companies").select("id, status", { count: "exact" }),
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("journeys").select("id", { count: "exact" }),
        supabase.from("vehicles").select("id", { count: "exact" }),
      ]);

      const totalCompanies = companies.count || 0;
      const activeCompanies = companies.data?.filter(c => c.status === 'active').length || 0;
      const activeRate = totalCompanies > 0 ? (activeCompanies / totalCompanies) * 100 : 0;

      setPerformanceStats({
        totalCompanies,
        totalUsers: profiles.count || 0,
        totalRecords: (journeys.count || 0) + (vehicles.count || 0),
        activeRate,
        totalJourneys: journeys.count || 0,
        totalVehicles: vehicles.count || 0,
      });
    } catch (error: any) {
      console.error('Error fetching performance:', error);
    }
  };

  const fetchHealthData = async () => {
    try {
      const { data: companies, error } = await supabase
        .from("companies")
        .select("id, name, status, subscription_status, created_at")
        .order("name");

      if (error) throw error;

      // Get activity data for each company
      const companyIds = companies?.map(c => c.id) || [];
      
      const [vehicleCounts, journeyCounts] = await Promise.all([
        supabase.from("vehicles").select("company_id").in("company_id", companyIds.length > 0 ? companyIds : ['00000000-0000-0000-0000-000000000000']),
        supabase.from("journeys").select("company_id, created_at").in("company_id", companyIds.length > 0 ? companyIds : ['00000000-0000-0000-0000-000000000000']).order("created_at", { ascending: false }),
      ]);

      const vehicleMap: Record<string, number> = {};
      const journeyMap: Record<string, number> = {};
      const lastActivityMap: Record<string, string> = {};

      vehicleCounts.data?.forEach(v => {
        vehicleMap[v.company_id] = (vehicleMap[v.company_id] || 0) + 1;
      });

      journeyCounts.data?.forEach(j => {
        journeyMap[j.company_id] = (journeyMap[j.company_id] || 0) + 1;
        if (!lastActivityMap[j.company_id] && j.created_at) {
          lastActivityMap[j.company_id] = j.created_at;
        }
      });

      // Calculate health scores
      const healthData: CompanyHealth[] = (companies || []).map((company) => {
        const vehicleCount = vehicleMap[company.id] || 0;
        const journeyCount = journeyMap[company.id] || 0;
        const lastActivity = lastActivityMap[company.id] || company.created_at;
        
        // Health score based on: active status, subscription, vehicles, journeys, recent activity
        let score = 50; // Base score
        if (company.status === 'active') score += 20;
        if (company.subscription_status === 'active') score += 15;
        if (vehicleCount > 0) score += 10;
        if (journeyCount > 0) score += 5;
        
        // Recent activity bonus
        const daysSinceActivity = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceActivity <= 7) score = Math.min(100, score + 10);
        else if (daysSinceActivity > 30) score = Math.max(0, score - 20);

        return {
          id: company.id,
          name: company.name,
          status: company.status,
          subscription_status: company.subscription_status,
          health_score: Math.min(100, Math.max(0, score)),
          last_activity: lastActivity,
          vehicle_count: vehicleCount,
          journey_count: journeyCount,
        };
      });

      // Sort by health score
      healthData.sort((a, b) => a.health_score - b.health_score);
      setCompaniesHealth(healthData);
    } catch (error: any) {
      console.error('Error fetching health:', error);
    }
  };

  const getHealthBadge = (score: number) => {
    if (score >= 80) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Saudável
        </Badge>
      );
    } else if (score >= 60) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          <AlertCircle className="h-3 w-3 mr-1" />
          Atenção
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Crítico
        </Badge>
      );
    }
  };

  const formatRelativeDate = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `${diffDays} dias atrás`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas atrás`;
    return then.toLocaleDateString("pt-BR");
  };

  const exportToPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const { applyPlugin } = await import('jspdf-autotable');
      applyPlugin(jsPDF);
      
      const doc = new jsPDF() as any;
      
      doc.setFontSize(18);
      doc.setTextColor('#0ea5e9');
      doc.text('Relatório Consolidado', 20, 20);
      
      doc.setFontSize(10);
      doc.setTextColor('#6b7280');
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 20, 30);
      
      // Performance section
      doc.setFontSize(14);
      doc.setTextColor('#000000');
      doc.text('Métricas de Performance', 20, 45);
      
      doc.setFontSize(10);
      doc.text(`Total de Empresas: ${performanceStats.totalCompanies}`, 20, 55);
      doc.text(`Total de Usuários: ${performanceStats.totalUsers}`, 20, 62);
      doc.text(`Total de Jornadas: ${performanceStats.totalJourneys}`, 20, 69);
      doc.text(`Total de Veículos: ${performanceStats.totalVehicles}`, 20, 76);
      doc.text(`Taxa de Atividade: ${performanceStats.activeRate.toFixed(1)}%`, 20, 83);

      // Usage table
      doc.text('Uso por Empresa e Módulo', 20, 100);
      doc.autoTable({
        head: [['Empresa', 'Módulo', 'Total de Ações']],
        body: usage.slice(0, 30).map(item => [
          item.company_name,
          item.module,
          item.action_count.toString()
        ]),
        startY: 105,
        headStyles: {
          fillColor: '#0ea5e9',
          textColor: '#ffffff',
          fontStyle: 'bold',
        },
      });
      
      const pageCount = doc.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor('#6b7280');
        doc.text('Gerado por Frota Link', 20, doc.internal.pageSize.height - 10);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
      }
      
      doc.save(`relatorio-consolidado-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: "✅ PDF gerado com sucesso!",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">Uso, performance e saúde dos clientes</p>
        </div>
        <Button onClick={exportToPDF} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="usage">Uso da Plataforma</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="health">Saúde dos Clientes</TabsTrigger>
        </TabsList>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Uso por Empresa e Módulo</CardTitle>
              <CardDescription>Ações realizadas na plataforma agrupadas por empresa e módulo</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead className="text-right">Total de Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Nenhum dado de uso disponível
                      </TableCell>
                    </TableRow>
                  ) : (
                    usage.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.company_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.module}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{item.action_count}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Empresas</CardTitle>
                <Activity className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{performanceStats.totalCompanies}</div>
                <p className="text-xs text-muted-foreground">Empresas cadastradas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{performanceStats.totalUsers}</div>
                <p className="text-xs text-muted-foreground">Usuários ativos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Jornadas</CardTitle>
                <Database className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{performanceStats.totalJourneys}</div>
                <p className="text-xs text-muted-foreground">Jornadas registradas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Atividade</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{performanceStats.activeRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Empresas ativas</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Veículos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary">{performanceStats.totalVehicles}</div>
                    <p className="text-muted-foreground">veículos cadastrados</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registros Totais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary">{performanceStats.totalRecords}</div>
                    <p className="text-muted-foreground">jornadas + veículos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Health Tab */}
        <TabsContent value="health" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status de Saúde por Empresa</CardTitle>
              <CardDescription>Monitoramento do engajamento e atividade dos clientes</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assinatura</TableHead>
                    <TableHead>Saúde</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Veículos</TableHead>
                    <TableHead>Última Atividade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companiesHealth.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nenhum dado disponível
                      </TableCell>
                    </TableRow>
                  ) : (
                    companiesHealth.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell>
                          <Badge variant={company.status === "active" ? "default" : "secondary"}>
                            {company.status === "active" ? "Ativo" : company.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {company.subscription_status === "active" ? "Ativa" : company.subscription_status || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>{getHealthBadge(company.health_score)}</TableCell>
                        <TableCell className="text-right font-medium">{company.health_score}/100</TableCell>
                        <TableCell className="text-right">{company.vehicle_count}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatRelativeDate(company.last_activity)}
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
    </div>
  );
}
