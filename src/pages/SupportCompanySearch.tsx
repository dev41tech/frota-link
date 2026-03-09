import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wrench, Search, LogOut, ArrowRight, Building2 } from "lucide-react";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Company {
  id: string;
  name: string;
  cnpj: string;
  status: string;
  responsible_name: string;
  subscription_plan?: {
    name: string;
  };
}

export default function SupportCompanySearch() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { setCompanyContext, isSupport, isLoading: staffLoading } = useStaffAccess();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);

  // Redirect if not support
  if (!staffLoading && !isSupport) {
    navigate('/home');
    return null;
  }

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Busca vazia",
        description: "Digite um nome, CNPJ ou responsável para buscar",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const searchPattern = `%${searchTerm}%`;
      
      const { data, error } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          cnpj,
          status,
          responsible_name,
          subscription_plan:subscription_plans (name)
        `)
        .or(`name.ilike.${searchPattern},cnpj.ilike.${searchPattern},responsible_name.ilike.${searchPattern}`)
        .order('name')
        .limit(50);

      if (error) throw error;
      
      setCompanies(data || []);
    } catch (error) {
      console.error('Error searching companies:', error);
      toast({
        title: "Erro na busca",
        description: "Não foi possível buscar empresas",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCompany = async (company: Company) => {
    try {
      setSelecting(company.id);
      await setCompanyContext(company.id, company.name);
      navigate('/home');
    } catch (error) {
      console.error('Error selecting company:', error);
      toast({
        title: "Erro",
        description: "Não foi possível acessar a empresa",
        variant: "destructive"
      });
      setSelecting(null);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 p-2 rounded-lg">
              <Wrench className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Frota Link Suporte</h1>
              <p className="text-sm text-muted-foreground">Acesso Técnico</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        <Card>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl">Busca de Empresas</CardTitle>
            <CardDescription>
              Pesquise qualquer empresa cadastrada no sistema para investigar bugs ou configurações
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CNPJ ou responsável..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Buscar
                  </>
                )}
              </Button>
            </div>

            {/* Results */}
            {hasSearched && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {companies.length} empresa{companies.length !== 1 ? 's' : ''} encontrada{companies.length !== 1 ? 's' : ''}
                </p>

                {companies.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma empresa encontrada com esse termo</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead>CNPJ</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companies.map((company) => (
                          <TableRow key={company.id}>
                            <TableCell className="font-medium">{company.name}</TableCell>
                            <TableCell className="text-muted-foreground">{company.cnpj}</TableCell>
                            <TableCell>{company.responsible_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {company.subscription_plan?.name || 'Sem plano'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={company.status === 'active' ? 'default' : 'destructive'}>
                                {company.status === 'active' ? 'Ativa' : company.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                size="sm"
                                onClick={() => handleSelectCompany(company)}
                                disabled={selecting === company.id}
                              >
                                {selecting === company.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                ) : (
                                  <>
                                    Acessar
                                    <ArrowRight className="h-4 w-4 ml-1" />
                                  </>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            {!hasSearched && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Digite um termo de busca para encontrar empresas</p>
                <p className="text-sm mt-2">
                  Você pode buscar por nome, CNPJ ou nome do responsável
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
