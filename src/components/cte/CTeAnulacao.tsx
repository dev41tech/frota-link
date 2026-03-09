import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, FileX, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { Badge } from '@/components/ui/badge';

interface OriginalCTe {
  id: string;
  cte_number: string;
  cte_key: string;
  emission_date: string;
  recipient_name: string;
  freight_value: number;
  status: string;
}

export function CTeAnulacao() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCTe, setSelectedCTe] = useState<OriginalCTe | null>(null);
  const [eligibleCTes, setEligibleCTes] = useState<OriginalCTe[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [substituteCTeKey, setSubstituteCTeKey] = useState('');
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();

  useEffect(() => {
    if (currentCompany) {
      fetchEligibleCTes();
    }
  }, [currentCompany]);

  const fetchEligibleCTes = async () => {
    if (!currentCompany) return;

    try {
      setLoading(true);
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data, error } = await supabase
        .from('cte_documents')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('status', 'authorized')
        .gte('emission_date', twentyFourHoursAgo.toISOString())
        .order('emission_date', { ascending: false });

      if (error) throw error;

      setEligibleCTes(data || []);
    } catch (error) {
      console.error('Error fetching eligible CT-es:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os CT-es elegíveis",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const found = eligibleCTes.find(
      cte => cte.cte_number === searchTerm || cte.cte_key === searchTerm
    );

    if (found) {
      setSelectedCTe(found);
      toast({
        title: "CT-e encontrado",
        description: `CT-e número ${found.cte_number} selecionado`
      });
    } else {
      toast({
        title: "CT-e não encontrado",
        description: "Verifique o número ou chave do CT-e",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async () => {
    if (!selectedCTe || !currentCompany) return;

    if (cancellationReason.length < 15) {
      toast({
        title: "Motivo inválido",
        description: "O motivo deve ter no mínimo 15 caracteres",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('cte-anulacao', {
        body: {
          original_cte_id: selectedCTe.id,
          cancellation_reason: cancellationReason,
          substitute_cte_key: substituteCTeKey || null
        }
      });

      if (error) throw error;

      toast({
        title: "CT-e de Anulação emitido!",
        description: `CT-e de anulação número ${data.cte_number} foi emitido com sucesso`
      });

      // Reset form
      setSelectedCTe(null);
      setSearchTerm('');
      setCancellationReason('');
      setSubstituteCTeKey('');
      fetchEligibleCTes();

    } catch (error: any) {
      toast({
        title: "Erro ao emitir CT-e de Anulação",
        description: error.message || "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          O CT-e de Anulação substitui um CT-e autorizado que foi emitido indevidamente. 
          Só é possível anular CT-es emitidos há menos de 24 horas.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Buscar CT-e Original</CardTitle>
          <CardDescription>
            Busque pelo número ou chave do CT-e que deseja anular
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Digite o número ou chave do CT-e"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>

          {eligibleCTes.length > 0 && (
            <div className="mt-4">
              <Label>CT-es Elegíveis para Anulação (últimas 24h)</Label>
              <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                {eligibleCTes.map(cte => (
                  <div
                    key={cte.id}
                    className={`p-3 border rounded-lg cursor-pointer hover:bg-accent ${
                      selectedCTe?.id === cte.id ? 'border-primary bg-accent' : ''
                    }`}
                    onClick={() => setSelectedCTe(cte)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">CT-e Nº {cte.cte_number}</p>
                        <p className="text-sm text-muted-foreground">{cte.recipient_name}</p>
                      </div>
                      <Badge variant="outline">
                        R$ {cte.freight_value?.toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCTe && (
        <Card>
          <CardHeader>
            <CardTitle>Dados da Anulação</CardTitle>
            <CardDescription>
              CT-e Original: Nº {selectedCTe.cte_number}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>CT-e Original (Bloqueado)</Label>
              <Input value={`CT-e Nº ${selectedCTe.cte_number} - ${selectedCTe.recipient_name}`} disabled />
            </div>

            <div className="space-y-2">
              <Label>Chave do CT-e Substituto (Opcional)</Label>
              <Input
                placeholder="44 dígitos da chave de acesso"
                value={substituteCTeKey}
                onChange={(e) => setSubstituteCTeKey(e.target.value)}
                maxLength={44}
              />
            </div>

            <div className="space-y-2">
              <Label>Motivo da Anulação *</Label>
              <Textarea
                placeholder="Descreva o motivo da anulação (mínimo 15 caracteres)"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={4}
              />
              <p className="text-sm text-muted-foreground">
                {cancellationReason.length}/15 caracteres mínimos
              </p>
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={loading || cancellationReason.length < 15}
            >
              <FileX className="h-4 w-4 mr-2" />
              Emitir CT-e de Anulação
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
