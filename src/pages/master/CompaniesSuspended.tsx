import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Company {
  id: string;
  name: string;
  cnpj: string;
  status: string;
  subscription_status: string;
  subscription_started_at: string;
}

export default function CompaniesSuspended() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSuspendedCompanies();
  }, []);

  const fetchSuspendedCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("status", "suspended")
        .order("name");

      if (error) throw error;
      setCompanies(data || []);
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

  const handleReactivate = async (id: string) => {
    try {
      const { error } = await supabase
        .from("companies")
        .update({ status: "active", subscription_status: "active" })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Empresa reativada com sucesso",
      });

      fetchSuspendedCompanies();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
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
        <h1 className="text-3xl font-bold">Empresas Suspensas</h1>
        <p className="text-muted-foreground">Gestão de empresas suspensas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Empresas Suspensas ({companies.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma empresa suspensa
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assinatura</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>{company.cnpj}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">Suspensa</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{company.subscription_status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReactivate(company.id)}
                      >
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Reativar
                      </Button>
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
