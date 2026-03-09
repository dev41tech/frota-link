import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { FileText, TrendingUp, AlertCircle, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatCurrency, parseDateString } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardStats {
  totalCTe: number;
  totalMDFe: number;
  totalValue: number;
  authorized: number;
  pending: number;
  cancelled: number;
  certificateExpiry: string | null;
  certificateStatus: 'valid' | 'expiring' | 'expired' | 'none';
}

export function FiscalDocumentsDashboard() {
  const { currentCompany } = useMultiTenant();
  const [stats, setStats] = useState<DashboardStats>({
    totalCTe: 0,
    totalMDFe: 0,
    totalValue: 0,
    authorized: 0,
    pending: 0,
    cancelled: 0,
    certificateExpiry: null,
    certificateStatus: 'none'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany) {
      fetchDashboardData();
    }
  }, [currentCompany]);

  const fetchDashboardData = async () => {
    if (!currentCompany) return;

    try {
      setLoading(true);
      const startDate = startOfMonth(new Date());
      const endDate = endOfMonth(new Date());

      // Fetch CT-e documents
      const { data: cteData, error: cteError } = await supabase
        .from('cte_documents')
        .select('status, freight_value')
        .eq('company_id', currentCompany.id)
        .gte('emission_date', startDate.toISOString())
        .lte('emission_date', endDate.toISOString());

      if (cteError) throw cteError;

      // Calculate stats
      const totalCTe = cteData?.length || 0;
      const totalValue = cteData?.reduce((sum, doc) => sum + (Number(doc.freight_value) || 0), 0) || 0;
      const authorized = cteData?.filter(doc => doc.status === 'authorized').length || 0;
      const pending = cteData?.filter(doc => doc.status === 'processing' || doc.status === 'draft').length || 0;
      const cancelled = cteData?.filter(doc => doc.status === 'cancelled').length || 0;

      // Fetch certificate info
      const { data: certData } = await supabase
        .from('digital_certificates')
        .select('expires_at, status')
        .eq('company_id', currentCompany.id)
        .eq('status', 'active')
        .order('expires_at', { ascending: false })
        .limit(1)
        .single();

      let certificateStatus: 'valid' | 'expiring' | 'expired' | 'none' = 'none';
      if (certData?.expires_at) {
        const expiryDate = new Date(certData.expires_at);
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry < 0) {
          certificateStatus = 'expired';
        } else if (daysUntilExpiry <= 30) {
          certificateStatus = 'expiring';
        } else {
          certificateStatus = 'valid';
        }
      }

      setStats({
        totalCTe,
        totalMDFe: 0, // Will be implemented when MDF-e table is created
        totalValue,
        authorized,
        pending,
        cancelled,
        certificateExpiry: certData?.expires_at || null,
        certificateStatus
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCertificateAlert = () => {
    if (stats.certificateStatus === 'none') {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhum certificado digital configurado. Configure um certificado em Configurações para emitir documentos fiscais.
          </AlertDescription>
        </Alert>
      );
    }

    if (stats.certificateStatus === 'expired') {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Certificado digital vencido! Atualize o certificado em Configurações para continuar emitindo documentos.
          </AlertDescription>
        </Alert>
      );
    }

    if (stats.certificateStatus === 'expiring') {
      const daysUntilExpiry = Math.floor(
        (new Date(stats.certificateExpiry!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Certificado digital vence em {daysUntilExpiry} dias. Renove o certificado para evitar interrupções.
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {getCertificateAlert()}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CT-es Emitidos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCTe}</div>
            <p className="text-xs text-muted-foreground">
              Este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Transportado</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              Total em CT-es
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MDF-es Ativos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMDFe}</div>
            <p className="text-xs text-muted-foreground">
              Em trânsito
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certificado</CardTitle>
            {stats.certificateStatus === 'valid' && <CheckCircle className="h-4 w-4 text-green-500" />}
            {stats.certificateStatus === 'expiring' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
            {(stats.certificateStatus === 'expired' || stats.certificateStatus === 'none') && (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {stats.certificateExpiry ? (
                <>
                  Válido até<br />
                  {format(parseDateString(stats.certificateExpiry), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </>
              ) : (
                'Não configurado'
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status dos Documentos</CardTitle>
          <CardDescription>Situação atual dos documentos emitidos este mês</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Autorizados</span>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {stats.authorized}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <span>Processando</span>
            </div>
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              {stats.pending}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span>Cancelados</span>
            </div>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              {stats.cancelled}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
