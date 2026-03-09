import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Search, Clock, LogOut, Crown, AlertCircle } from "lucide-react";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function BPOCompanySelector() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { 
    accessibleCompanies, 
    isLoading, 
    setCompanyContext, 
    fetchAccessibleCompanies,
    isBPO 
  } = useStaffAccess();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    if (!isBPO && !isLoading) {
      navigate('/home');
    }
  }, [isBPO, isLoading, navigate]);

  useEffect(() => {
    fetchAccessibleCompanies();
  }, [fetchAccessibleCompanies]);

  const handleSelectCompany = async (companyId: string, companyName: string) => {
    try {
      setSelecting(companyId);
      await setCompanyContext(companyId, companyName);
      navigate('/home');
    } catch (error) {
      console.error('Error selecting company:', error);
      setSelecting(null);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  // Filter out entries where company data is null (RLS issue)
  const companiesWithData = accessibleCompanies.filter(access => access.company?.id);
  
  // Filter and sort companies (Concierge first)
  const filteredCompanies = companiesWithData
    .filter(access => 
      access.company?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      access.company?.cnpj?.includes(searchTerm)
    )
    .sort((a, b) => {
      const aIsConcierge = a.company?.subscription_plan?.name === 'Concierge';
      const bIsConcierge = b.company?.subscription_plan?.name === 'Concierge';
      if (aIsConcierge && !bIsConcierge) return -1;
      if (!aIsConcierge && bIsConcierge) return 1;
      return (a.company?.name || '').localeCompare(b.company?.name || '');
    });
  
  // Check for RLS issue: has links but no company data
  const hasRlsIssue = accessibleCompanies.length > 0 && companiesWithData.length === 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mostrar mensagem quando não há empresas disponíveis
  if (!isLoading && accessibleCompanies.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 rounded-full bg-amber-500/10 w-fit">
              <AlertCircle className="h-8 w-8 text-amber-500" />
            </div>
            <CardTitle>Sem Empresas Atribuídas</CardTitle>
            <CardDescription>
              Você não possui empresas vinculadas ao seu perfil BPO.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Entre em contato com o administrador para solicitar acesso às empresas.
            </p>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Frota Link BPO</h1>
              <p className="text-sm text-muted-foreground">Acesso Operacional</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6">
        <Card>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl">Selecione uma Empresa</CardTitle>
            <CardDescription>
              Você tem acesso a {companiesWithData.length} empresa{companiesWithData.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Company List */}
            <div className="space-y-3">
              {filteredCompanies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {hasRlsIssue ? (
                    <div className="space-y-3">
                      <AlertCircle className="h-8 w-8 mx-auto text-amber-500" />
                      <p>Você possui vínculos, mas não foi possível carregar os dados das empresas.</p>
                      <Button variant="outline" size="sm" onClick={() => fetchAccessibleCompanies()}>
                        Tentar novamente
                      </Button>
                    </div>
                  ) : searchTerm 
                    ? 'Nenhuma empresa encontrada com esse termo'
                    : 'Nenhuma empresa vinculada à sua conta'
                  }
                </div>
              ) : (
                filteredCompanies.map((access) => {
                  const company = access.company;
                  const isConcierge = company?.subscription_plan?.name === 'Concierge';
                  
                  return (
                    <Card 
                      key={access.id}
                      className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${
                        isConcierge ? 'border-amber-500/30 bg-amber-500/5' : ''
                      }`}
                      onClick={() => handleSelectCompany(company.id, company.name)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              isConcierge ? 'bg-amber-500/20' : 'bg-muted'
                            }`}>
                              {isConcierge ? (
                                <Crown className="h-5 w-5 text-amber-600" />
                              ) : (
                                <Building2 className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{company?.name}</span>
                                {isConcierge && (
                                  <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">
                                    Concierge
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                CNPJ: {company?.cnpj}
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <Badge variant={company?.status === 'active' ? 'default' : 'secondary'}>
                              {company?.status === 'active' ? 'Ativa' : company?.status}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-end gap-1">
                              <Clock className="h-3 w-3" />
                              Acesso desde {formatDistanceToNow(new Date(access.granted_at), { 
                                addSuffix: false, 
                                locale: ptBR 
                              })}
                            </p>
                          </div>
                        </div>
                        
                        {selecting === company?.id && (
                          <div className="mt-3 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                            <span className="ml-2 text-sm text-muted-foreground">
                              Acessando...
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
