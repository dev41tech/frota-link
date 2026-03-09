import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Route, Plus, X, AlertCircle, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { CTeInfo } from './MDFeCTeSelector';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const UF_LIST = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

// UF order for route calculation (North to South, West to East) - fallback only
const UF_ORDER: Record<string, number> = {
  'RR': 1, 'AP': 2, 'AM': 3, 'PA': 4, 'AC': 5, 'RO': 6, 'TO': 7,
  'MA': 8, 'PI': 9, 'CE': 10, 'RN': 11, 'PB': 12, 'PE': 13, 'AL': 14, 'SE': 15, 'BA': 16,
  'MT': 17, 'DF': 18, 'GO': 19, 'MS': 20, 'MG': 21, 'ES': 22, 'RJ': 23, 'SP': 24,
  'PR': 25, 'SC': 26, 'RS': 27
};

export interface MunicipioDescarga {
  codigo: string;
  nome: string;
  uf: string;
  cteKeys: string[];
}

export interface MDFeRouteData {
  ufCarregamento: string;
  municipioCarregamento: string;
  codigoMunicipioCarregamento: string;
  ufsPercurso: string[];
  municipiosDescarregamento: MunicipioDescarga[];
}

interface MDFeRouteStepProps {
  value: MDFeRouteData;
  onChange: (data: MDFeRouteData) => void;
  ctes: CTeInfo[];
}

export function MDFeRouteStep({ value, onChange, ctes }: MDFeRouteStepProps) {
  const { toast } = useToast();
  const [newDescarregamento, setNewDescarregamento] = useState({
    uf: '',
    municipio: '',
    codigo: ''
  });
  const [cepCarregamento, setCepCarregamento] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  const [hasAutoFilled, setHasAutoFilled] = useState(false);
  const [calculatingRoute, setCalculatingRoute] = useState(false);

  // Calculate intermediate UFs based on geographic order (fallback)
  const calculateIntermediateUfsFallback = (originUf: string, destUfs: string[]): string[] => {
    if (!originUf || destUfs.length === 0) return [];
    
    const originOrder = UF_ORDER[originUf] || 0;
    const allUfs = new Set<string>();
    
    destUfs.forEach(destUf => {
      const destOrder = UF_ORDER[destUf] || 0;
      if (destOrder === originOrder) return;
      
      // Get UFs between origin and destination based on order
      const minOrder = Math.min(originOrder, destOrder);
      const maxOrder = Math.max(originOrder, destOrder);
      
      Object.entries(UF_ORDER).forEach(([uf, order]) => {
        if (order > minOrder && order < maxOrder) {
          allUfs.add(uf);
        }
      });
    });
    
    // Sort by geographic order
    return Array.from(allUfs).sort((a, b) => (UF_ORDER[a] || 0) - (UF_ORDER[b] || 0));
  };

  // Calculate intermediate UFs using AI
  const calculateRouteWithAI = async (
    originCity: string, 
    originUf: string, 
    destinations: Array<{ city: string; uf: string }>
  ): Promise<string[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('calculate-route-ufs', {
        body: { originCity, originUf, destinations }
      });
      
      if (error) {
        console.error('Erro ao calcular rota com IA:', error);
        throw error;
      }
      
      if (data?.ufs && Array.isArray(data.ufs) && data.ufs.length > 0) {
        console.log('Rota calculada por IA:', data.ufs);
        return data.ufs;
      }
      
      // Return empty if AI says no intermediate UFs
      return [];
    } catch (error) {
      console.error('Fallback para cálculo geográfico:', error);
      // Fallback to geographic calculation
      return calculateIntermediateUfsFallback(originUf, destinations.map(d => d.uf));
    }
  };

  // Auto-fill route based on CT-es
  const autoFillRoute = async () => {
    if (ctes.length === 0) {
      toast({
        title: "Nenhum CT-e selecionado",
        description: "Selecione pelo menos um CT-e para preencher automaticamente",
        variant: "destructive"
      });
      return;
    }

    setCalculatingRoute(true);
    
    try {
      const firstCte = ctes[0];
      
      // Build unloading municipalities grouped by city code
      const destinos = new Map<string, MunicipioDescarga>();
      ctes.forEach(cte => {
        const cityCode = cte.destCityCode || cte.destCity;
        if (!cityCode) return;
        
        if (!destinos.has(cityCode)) {
          destinos.set(cityCode, {
            codigo: cte.destCityCode || '',
            nome: cte.destCity || '',
            uf: cte.destUf || '',
            cteKeys: [cte.cteKey]
          });
        } else {
          destinos.get(cityCode)!.cteKeys.push(cte.cteKey);
        }
      });

      // Build destinations for AI calculation
      const destinations = ctes
        .filter(c => c.destCity && c.destUf)
        .map(c => ({ city: c.destCity || '', uf: c.destUf }));

      // Calculate intermediate UFs using AI
      const ufsPercurso = await calculateRouteWithAI(
        firstCte.originCity || '',
        firstCte.originUf,
        destinations
      );

      onChange({
        ufCarregamento: firstCte.originUf || '',
        municipioCarregamento: firstCte.originCity || '',
        codigoMunicipioCarregamento: firstCte.originCityCode || '',
        ufsPercurso,
        municipiosDescarregamento: Array.from(destinos.values())
      });

      setHasAutoFilled(true);
      toast({
        title: "Percurso preenchido",
        description: `Carregamento: ${firstCte.originCity || firstCte.originUf}, Descarregamento: ${destinos.size} município(s)${ufsPercurso.length > 0 ? `, Percurso: ${ufsPercurso.join(' → ')}` : ''}`
      });
    } catch (error) {
      console.error('Erro ao preencher percurso:', error);
      toast({
        title: "Erro ao preencher",
        description: "Não foi possível preencher o percurso automaticamente",
        variant: "destructive"
      });
    } finally {
      setCalculatingRoute(false);
    }
  };

  const handleCepLookup = async () => {
    const cleanCep = cepCarregamento.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      toast({
        title: "CEP inválido",
        description: "O CEP deve ter 8 dígitos",
        variant: "destructive"
      });
      return;
    }

    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP informado",
          variant: "destructive"
        });
        return;
      }

      onChange({
        ...value,
        ufCarregamento: data.uf,
        municipioCarregamento: data.localidade,
        codigoMunicipioCarregamento: data.ibge
      });

      toast({
        title: "Município encontrado",
        description: `${data.localidade}/${data.uf}`
      });
    } catch (error) {
      toast({
        title: "Erro na consulta",
        description: "Não foi possível consultar o CEP",
        variant: "destructive"
      });
    } finally {
      setLoadingCep(false);
    }
  };

  const addUfPercurso = (uf: string) => {
    if (!uf || value.ufsPercurso.includes(uf)) return;
    onChange({
      ...value,
      ufsPercurso: [...value.ufsPercurso, uf]
    });
  };

  const removeUfPercurso = (uf: string) => {
    onChange({
      ...value,
      ufsPercurso: value.ufsPercurso.filter(u => u !== uf)
    });
  };

  const addDescarregamento = () => {
    if (!newDescarregamento.uf || !newDescarregamento.municipio || !newDescarregamento.codigo) {
      toast({
        title: "Dados incompletos",
        description: "Preencha UF, município e código IBGE",
        variant: "destructive"
      });
      return;
    }

    // Check if already exists
    if (value.municipiosDescarregamento.some(m => m.codigo === newDescarregamento.codigo)) {
      toast({
        title: "Município já adicionado",
        description: "Este município já está na lista de descarregamento",
        variant: "destructive"
      });
      return;
    }

    // Auto-assign all CT-es with matching destination UF
    const matchingCteKeys = ctes
      .filter(c => c.destUf === newDescarregamento.uf)
      .map(c => c.cteKey);

    onChange({
      ...value,
      municipiosDescarregamento: [
        ...value.municipiosDescarregamento,
        {
          ...newDescarregamento,
          nome: newDescarregamento.municipio,
          cteKeys: matchingCteKeys
        }
      ]
    });

    setNewDescarregamento({ uf: '', municipio: '', codigo: '' });
  };

  const removeDescarregamento = (codigo: string) => {
    onChange({
      ...value,
      municipiosDescarregamento: value.municipiosDescarregamento.filter(m => m.codigo !== codigo)
    });
  };

  const toggleCteInMunicipio = (codigoMunicipio: string, cteKey: string) => {
    onChange({
      ...value,
      municipiosDescarregamento: value.municipiosDescarregamento.map(m => {
        if (m.codigo !== codigoMunicipio) return m;
        const hasCte = m.cteKeys.includes(cteKey);
        return {
          ...m,
          cteKeys: hasCte 
            ? m.cteKeys.filter(k => k !== cteKey)
            : [...m.cteKeys, cteKey]
        };
      })
    });
  };

  // Get unique destination UFs from CT-es
  const destUfs = [...new Set(ctes.map(c => c.destUf).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Auto-fill prompt */}
      {ctes.length > 0 && !hasAutoFilled && (
        <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-blue-700 dark:text-blue-300">
              Detectamos {ctes.length} CT-e(s) selecionado(s). Deseja preencher o percurso automaticamente?
            </span>
            <Button 
              size="sm" 
              onClick={autoFillRoute} 
              className="shrink-0"
              disabled={calculatingRoute}
            >
              {calculatingRoute ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Calculando rota...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1" />
                  Preencher Automaticamente
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Carregamento */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-primary" />
            <h4 className="font-medium">Local de Carregamento</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>CEP</Label>
              <div className="flex gap-2">
                <Input
                  value={cepCarregamento}
                  onChange={(e) => setCepCarregamento(e.target.value.replace(/\D/g, ''))}
                  placeholder="00000-000"
                  maxLength={8}
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCepLookup}
                  disabled={loadingCep || cepCarregamento.length < 8}
                >
                  Buscar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>UF *</Label>
              <Select
                value={value.ufCarregamento}
                onValueChange={(uf) => onChange({ ...value, ufCarregamento: uf })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {UF_LIST.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Município *</Label>
              <Input
                value={value.municipioCarregamento}
                onChange={(e) => onChange({ ...value, municipioCarregamento: e.target.value })}
                placeholder="Nome do município"
              />
            </div>

            <div className="space-y-2">
              <Label>Código IBGE *</Label>
              <Input
                value={value.codigoMunicipioCarregamento}
                onChange={(e) => onChange({ ...value, codigoMunicipioCarregamento: e.target.value.replace(/\D/g, '') })}
                placeholder="0000000"
                maxLength={7}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Percurso */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-4">
            <Route className="h-5 w-5 text-primary" />
            <h4 className="font-medium">UFs de Percurso</h4>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Adicione as UFs por onde o veículo passará (na ordem do trajeto)
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {value.ufsPercurso.length === 0 ? (
              <span className="text-sm text-muted-foreground">Nenhuma UF intermediária</span>
            ) : (
              value.ufsPercurso.map((uf, index) => (
                <Badge key={uf} variant="secondary" className="gap-1">
                  {index > 0 && <ArrowRight className="h-3 w-3" />}
                  {uf}
                  <button
                    type="button"
                    onClick={() => removeUfPercurso(uf)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <Select onValueChange={addUfPercurso}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Adicionar UF" />
              </SelectTrigger>
              <SelectContent>
                {UF_LIST.filter(uf => !value.ufsPercurso.includes(uf)).map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Descarregamento */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-destructive" />
            <h4 className="font-medium">Municípios de Descarregamento</h4>
          </div>

          {destUfs.length > 0 && value.municipiosDescarregamento.length === 0 && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Os CT-es selecionados têm destino em: {destUfs.join(', ')}. 
                Adicione os municípios de descarregamento correspondentes.
              </AlertDescription>
            </Alert>
          )}

          {/* Existing municipalities */}
          <div className="space-y-3 mb-4">
            {value.municipiosDescarregamento.map((mun) => (
              <div key={mun.codigo} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge>{mun.uf}</Badge>
                    <span className="font-medium">{mun.nome}</span>
                    <span className="text-xs text-muted-foreground">({mun.codigo})</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeDescarregamento(mun.codigo)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {ctes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground">CT-es:</span>
                    {ctes.map((cte) => (
                      <Badge
                        key={cte.cteKey}
                        variant={mun.cteKeys.includes(cte.cteKey) ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        onClick={() => toggleCteInMunicipio(mun.codigo, cte.cteKey)}
                      >
                        {cte.cteNumber}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add new municipality */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-2">
              <Label>UF</Label>
              <Select
                value={newDescarregamento.uf}
                onValueChange={(uf) => setNewDescarregamento({ ...newDescarregamento, uf })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {UF_LIST.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Município</Label>
              <Input
                value={newDescarregamento.municipio}
                onChange={(e) => setNewDescarregamento({ ...newDescarregamento, municipio: e.target.value })}
                placeholder="Nome do município"
              />
            </div>

            <div className="space-y-2">
              <Label>Código IBGE</Label>
              <Input
                value={newDescarregamento.codigo}
                onChange={(e) => setNewDescarregamento({ ...newDescarregamento, codigo: e.target.value.replace(/\D/g, '') })}
                placeholder="0000000"
                maxLength={7}
              />
            </div>

            <Button onClick={addDescarregamento} className="w-full md:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const emptyRouteData: MDFeRouteData = {
  ufCarregamento: '',
  municipioCarregamento: '',
  codigoMunicipioCarregamento: '',
  ufsPercurso: [],
  municipiosDescarregamento: []
};
