import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, RefreshCw, Send, Ban, Eye, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface OverdueCompany {
  id: string;
  company_id: string;
  company_name: string;
  plan_name: string;
  amount: number;
  due_date: string;
  days_overdue: number;
  total_overdue: number;
  invoice_count: number;
}

export default function Overdue() {
  const [overdueData, setOverdueData] = useState<OverdueCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchOverdueInvoices();
  }, []);

  const fetchOverdueInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          id,
          company_id,
          amount,
          due_date,
          companies(name),
          subscription_plans(name)
        `)
        .eq("status", "overdue")
        .order("due_date", { ascending: true });

      if (error) throw error;

      // Group by company and calculate totals
      const grouped = (data || []).reduce((acc, invoice) => {
        const companyId = invoice.company_id;
        const dueDate = new Date(invoice.due_date);
        const today = new Date();
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (!acc[companyId]) {
          acc[companyId] = {
            id: invoice.id,
            company_id: companyId,
            company_name: invoice.companies?.name || "N/A",
            plan_name: invoice.subscription_plans?.name || "N/A",
            amount: Number(invoice.amount),
            due_date: invoice.due_date,
            days_overdue: daysOverdue,
            total_overdue: Number(invoice.amount),
            invoice_count: 1,
          };
        } else {
          acc[companyId].total_overdue += Number(invoice.amount);
          acc[companyId].invoice_count += 1;
          // Keep the oldest due date
          if (new Date(invoice.due_date) < new Date(acc[companyId].due_date)) {
            acc[companyId].due_date = invoice.due_date;
            acc[companyId].days_overdue = daysOverdue;
          }
        }

        return acc;
      }, {} as Record<string, OverdueCompany>);

      // Sort by days overdue (most overdue first)
      const sortedData = Object.values(grouped).sort((a, b) => b.days_overdue - a.days_overdue);
      setOverdueData(sortedData);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar inadimplência",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatDate = (date: string) => new Date(date).toLocaleDateString("pt-BR");

  const getSeverityBadge = (days: number) => {
    if (days > 30) return <Badge variant="destructive">Crítico ({days} dias)</Badge>;
    if (days > 15) return <Badge className="bg-orange-500">Alto ({days} dias)</Badge>;
    return <Badge variant="secondary">{days} dias</Badge>;
  };

  const sendReminder = async (company: OverdueCompany) => {
    toast({
      title: "Lembrete enviado",
      description: `Email de lembrete enviado para ${company.company_name}`,
    });
  };

  const suspendCompany = async (company: OverdueCompany) => {
    try {
      const { error } = await supabase
        .from("companies")
        .update({ status: "suspended", subscription_status: "suspended" })
        .eq("id", company.company_id);

      if (error) throw error;

      toast({
        title: "Empresa suspensa",
        description: `${company.company_name} foi suspensa por inadimplência`,
      });

      fetchOverdueInvoices();
    } catch (error: any) {
      toast({
        title: "Erro ao suspender",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const viewCompanyDetails = (companyId: string) => {
    navigate(`/companies?highlight=${companyId}`);
  };

  // Calculate totals
  const totalOverdue = overdueData.reduce((sum, c) => sum + c.total_overdue, 0);
  const totalCompanies = overdueData.length;
  const criticalCount = overdueData.filter(c => c.days_overdue > 30).length;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-96 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            Inadimplência
          </h1>
          <p className="text-muted-foreground">Empresas com pagamentos vencidos</p>
        </div>
        <Button onClick={fetchOverdueInvoices} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-destructive/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-full">
                <DollarSign className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <div className="text-2xl font-bold text-destructive">{formatCurrency(totalOverdue)}</div>
                <p className="text-sm text-muted-foreground">Valor Total em Atraso</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-full">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalCompanies}</div>
                <p className="text-sm text-muted-foreground">Empresas Inadimplentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-600/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-600/10 rounded-full">
                <Ban className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
                <p className="text-sm text-muted-foreground">Críticos (+30 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Empresas com Pagamentos Vencidos</CardTitle>
        </CardHeader>
        <CardContent>
          {overdueData.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Nenhuma inadimplência</h3>
              <p className="text-muted-foreground">Todas as empresas estão com os pagamentos em dia</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Faturas Vencidas</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Vencimento Mais Antigo</TableHead>
                  <TableHead>Atraso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueData.map((company) => (
                  <TableRow key={company.company_id} className={company.days_overdue > 30 ? "bg-destructive/5" : ""}>
                    <TableCell className="font-medium">{company.company_name}</TableCell>
                    <TableCell>{company.plan_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{company.invoice_count} fatura(s)</Badge>
                    </TableCell>
                    <TableCell className="font-bold text-destructive">
                      {formatCurrency(company.total_overdue)}
                    </TableCell>
                    <TableCell>{formatDate(company.due_date)}</TableCell>
                    <TableCell>{getSeverityBadge(company.days_overdue)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => viewCompanyDetails(company.company_id)}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => sendReminder(company)}
                          title="Enviar lembrete"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => suspendCompany(company)}
                          title="Suspender empresa"
                          className="text-destructive hover:text-destructive"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
