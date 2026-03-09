import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Search, Upload, FileText, Plus, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { parseCTeXml } from '@/lib/cteXmlParser';
import { useToast } from '@/hooks/use-toast';

export interface CTeInfo {
  id: string;
  cteKey: string;
  cteNumber: string;
  senderName: string;
  recipientName: string;
  freightValue: number;
  weight: number;
  // Origin (loading)
  originUf: string;
  originCity: string;
  originCityCode: string;
  // Destination (unloading)
  destUf: string;
  destCity: string;
  destCityCode: string;
  emissionDate: string;
}

interface MDFeCTeSelectorProps {
  selectedCTes: CTeInfo[];
  onChange: (ctes: CTeInfo[]) => void;
  initialCTeKey?: string;
}

export function MDFeCTeSelector({ selectedCTes, onChange, initialCTeKey }: MDFeCTeSelectorProps) {
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();
  const [availableCTes, setAvailableCTes] = useState<CTeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  useEffect(() => {
    const fetchAuthorizedCTes = async () => {
      if (!currentCompany?.id) return;

      setLoading(true);
      const { data, error } = await supabase
        .from('cte_documents')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('status', 'authorized')
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        const ctes: CTeInfo[] = data.map(doc => {
          const cargoInfo = doc.cargo_info as any;
          const senderFull = doc.sender_full as any;
          const recipientFull = doc.recipient_full as any;

          return {
            id: doc.id,
            cteKey: doc.cte_key || '',
            cteNumber: doc.cte_number || '',
            senderName: doc.sender_name,
            recipientName: doc.recipient_name,
            freightValue: doc.freight_value || 0,
            weight: cargoInfo?.pesoBruto || 0,
            originUf: senderFull?.endereco?.uf || '',
            originCity: senderFull?.endereco?.cidade || '',
            originCityCode: senderFull?.endereco?.codigoIBGE || '',
            destUf: recipientFull?.endereco?.uf || '',
            destCity: recipientFull?.endereco?.cidade || '',
            destCityCode: recipientFull?.endereco?.codigoIBGE || '',
            emissionDate: doc.emission_date || doc.created_at
          };
        });
        setAvailableCTes(ctes);

        // Auto-select initial CT-e if provided
        if (initialCTeKey && selectedCTes.length === 0) {
          const initialCte = ctes.find(c => c.cteKey === initialCTeKey);
          if (initialCte) {
            onChange([initialCte]);
          }
        }
      }

      setLoading(false);
    };

    fetchAuthorizedCTes();
  }, [currentCompany?.id, initialCTeKey]);

  const handleToggleCTe = (cte: CTeInfo) => {
    const isSelected = selectedCTes.some(c => c.cteKey === cte.cteKey);
    if (isSelected) {
      onChange(selectedCTes.filter(c => c.cteKey !== cte.cteKey));
    } else {
      onChange([...selectedCTes, cte]);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCTeXml(text);
      
      if (!parsed) {
        toast({
          title: "Erro ao processar XML",
          description: "O arquivo não é um CT-e válido",
          variant: "destructive"
        });
        return;
      }

      // Check if already selected
      if (selectedCTes.some(c => c.cteKey === parsed.accessKey)) {
        toast({
          title: "CT-e já selecionado",
          description: `CT-e ${parsed.cteNumber} já está na lista`,
          variant: "destructive"
        });
        return;
      }

      const newCte: CTeInfo = {
        id: `imported-${Date.now()}`,
        cteKey: parsed.accessKey,
        cteNumber: parsed.cteNumber,
        senderName: parsed.sender.name,
        recipientName: parsed.recipient.name,
        freightValue: parsed.values.freightTotal,
        weight: 0,
        originUf: parsed.origin.uf,
        originCity: parsed.sender.address.cidade || parsed.origin.city,
        originCityCode: parsed.sender.address.codigoIBGE || '',
        destUf: parsed.destination.uf,
        destCity: parsed.recipient.address.cidade || parsed.destination.city,
        destCityCode: parsed.recipient.address.codigoIBGE || '',
        emissionDate: parsed.emissionDate
      };

      onChange([...selectedCTes, newCte]);
      toast({
        title: "CT-e importado",
        description: `CT-e ${parsed.cteNumber} adicionado à lista`
      });
    } catch (error) {
      toast({
        title: "Erro ao ler arquivo",
        description: "Não foi possível processar o arquivo XML",
        variant: "destructive"
      });
    }

    event.target.value = '';
  };

  const handleAddManualKey = () => {
    const cleanKey = manualKey.replace(/\D/g, '');
    
    if (cleanKey.length !== 44) {
      toast({
        title: "Chave inválida",
        description: "A chave de acesso deve ter 44 dígitos",
        variant: "destructive"
      });
      return;
    }

    // Check if already selected
    if (selectedCTes.some(c => c.cteKey === cleanKey)) {
      toast({
        title: "CT-e já selecionado",
        description: "Esta chave já está na lista",
        variant: "destructive"
      });
      return;
    }

    const newCte: CTeInfo = {
      id: `manual-${Date.now()}`,
      cteKey: cleanKey,
      cteNumber: cleanKey.substring(25, 34),
      senderName: 'Chave manual',
      recipientName: '-',
      freightValue: 0,
      weight: 0,
      originUf: cleanKey.substring(0, 2) === '35' ? 'SP' : '',
      originCity: '',
      originCityCode: '',
      destUf: '',
      destCity: '',
      destCityCode: '',
      emissionDate: ''
    };

    onChange([...selectedCTes, newCte]);
    setManualKey('');
    setShowManualInput(false);
    toast({
      title: "Chave adicionada",
      description: `Chave ${cleanKey.slice(0, 8)}... adicionada à lista`
    });
  };

  const removeCTe = (cteKey: string) => {
    onChange(selectedCTes.filter(c => c.cteKey !== cteKey));
  };

  const filteredCTes = availableCTes.filter(cte => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      cte.cteNumber.includes(term) ||
      cte.cteKey.includes(term) ||
      cte.senderName.toLowerCase().includes(term) ||
      cte.recipientName.toLowerCase().includes(term)
    );
  });

  const totalWeight = selectedCTes.reduce((sum, c) => sum + c.weight, 0);
  const totalValue = selectedCTes.reduce((sum, c) => sum + c.freightValue, 0);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatWeight = (weight: number) => {
    return weight.toLocaleString('pt-BR') + ' kg';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, chave, remetente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              Importar XML
              <input
                type="file"
                accept=".xml"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowManualInput(!showManualInput)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Chave Manual
          </Button>
        </div>
      </div>

      {showManualInput && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="sr-only">Chave de Acesso</Label>
                <Input
                  placeholder="Digite a chave de acesso do CT-e (44 dígitos)"
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value.replace(/\D/g, ''))}
                  maxLength={44}
                />
              </div>
              <Button onClick={handleAddManualKey} disabled={manualKey.length !== 44}>
                Adicionar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {manualKey.length}/44 dígitos
            </p>
          </CardContent>
        </Card>
      )}

      {/* Selected CT-es */}
      {selectedCTes.length > 0 && (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                CT-es Selecionados ({selectedCTes.length})
              </h4>
              <div className="text-sm text-muted-foreground">
                {formatWeight(totalWeight)} | {formatCurrency(totalValue)}
              </div>
            </div>
            <div className="space-y-2">
              {selectedCTes.map((cte) => (
                <div 
                  key={cte.cteKey}
                  className="flex items-center justify-between p-2 bg-background rounded border"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">CT-e {cte.cteNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {cte.senderName} → {cte.recipientName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      {cte.originUf} → {cte.destUf}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeCTe(cte.cteKey)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available CT-es */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando CT-es autorizados...
          </div>
        ) : filteredCTes.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {searchTerm 
                ? 'Nenhum CT-e encontrado com os critérios de busca'
                : 'Nenhum CT-e autorizado disponível. Importe XMLs ou adicione chaves manualmente.'}
            </AlertDescription>
          </Alert>
        ) : (
          filteredCTes.map((cte) => {
            const isSelected = selectedCTes.some(c => c.cteKey === cte.cteKey);
            return (
              <Card 
                key={cte.id}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                  isSelected ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => handleToggleCTe(cte)}
              >
                <CardContent className="py-3 flex items-center gap-4">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggleCTe(cte)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">CT-e {cte.cteNumber}</p>
                      <Badge variant="outline" className="text-xs">
                        {cte.originUf} → {cte.destUf}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {cte.senderName} → {cte.recipientName}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">{formatCurrency(cte.freightValue)}</p>
                    <p className="text-muted-foreground">{formatWeight(cte.weight)}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
