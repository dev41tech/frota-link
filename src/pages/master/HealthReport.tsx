import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CompanyHealth {
  id: string;
  name: string;
  status: string;
  subscription_status: string;
  health_score: number;
  last_activity: string;
}

export default function HealthReport() {
  const [companies, setCompanies] = useState<CompanyHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchHealthData();
  }, []);

  const fetchHealthData = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, status, subscription_status, created_at")
        .order("name");

      if (error) throw error;

      // Calculate mock health scores
      const healthData: CompanyHealth[] = (data || []).map((company) => ({
        ...company,
        health_score: Math.floor(Math.random() * 30) + 70, // Mock: 70-100
        last_activity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      }));

      setCompanies(healthData);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  const formatDate = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `${diffDays} dias atrás`;
    return then.toLocaleDateString("pt-BR");
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-96 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Saúde dos Clientes</h1>
        <p className="text-muted-foreground">Monitoramento do engajamento e atividade</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status de Saúde por Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assinatura</TableHead>
                <TableHead>Saúde</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Última Atividade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>
                    <Badge variant={company.status === "active" ? "default" : "secondary"}>
                      {company.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{company.subscription_status}</Badge>
                  </TableCell>
                  <TableCell>{getHealthBadge(company.health_score)}</TableCell>
                  <TableCell>{company.health_score}/100</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(company.last_activity)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
