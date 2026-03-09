import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Package, Scale, DollarSign, Box } from 'lucide-react';

export interface CargoData {
  natureza: string;
  pesoBruto: string;
  pesoLiquido: string;
  valorCarga: string;
  quantidade: string;
  unidadeMedida: string;
  cubagem: string;
  produtoPredominante: string;
  outraCaracteristica: string;
}

interface CargoInfoStepProps {
  value: CargoData;
  onChange: (data: CargoData) => void;
}

const UNIDADE_OPTIONS = [
  { value: 'UN', label: 'Unidade' },
  { value: 'KG', label: 'Quilograma' },
  { value: 'TON', label: 'Tonelada' },
  { value: 'M3', label: 'Metro Cúbico' },
  { value: 'LT', label: 'Litro' },
  { value: 'PC', label: 'Peça' },
  { value: 'CX', label: 'Caixa' },
  { value: 'FD', label: 'Fardo' },
  { value: 'PL', label: 'Palete' },
  { value: 'SC', label: 'Saco' },
];

const NATUREZA_SUGESTOES = [
  'Carga Geral',
  'Granel Sólido',
  'Granel Líquido',
  'Neogranel',
  'Perigosa Granel Sólido',
  'Perigosa Granel Líquido',
  'Perigosa Carga Geral',
  'Refrigerada',
  'Conteinerizada',
  'Veículos',
  'Mudança',
  'Alimentos',
  'Produtos Químicos',
  'Material de Construção',
  'Produtos Agrícolas',
];

export function CargoInfoStep({ value, onChange }: CargoInfoStepProps) {
  const formatCurrency = (val: string) => {
    const num = val.replace(/\D/g, '');
    const formatted = (parseInt(num || '0') / 100).toFixed(2);
    return formatted.replace('.', ',');
  };

  const parseCurrency = (val: string) => {
    return val.replace(/\D/g, '');
  };

  const formatWeight = (val: string) => {
    const num = val.replace(/\D/g, '');
    if (!num) return '';
    const formatted = (parseInt(num) / 1000).toFixed(3);
    return formatted.replace('.', ',');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Natureza da Carga */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Natureza da Carga</h4>
            </div>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Natureza *</Label>
                <Input
                  value={value.natureza}
                  onChange={(e) => onChange({ ...value, natureza: e.target.value })}
                  placeholder="Ex: Carga Geral"
                  list="natureza-sugestoes"
                />
                <datalist id="natureza-sugestoes">
                  {NATUREZA_SUGESTOES.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Descrição da natureza predominante da carga
                </p>
              </div>

              <div className="space-y-2">
                <Label>Produto Predominante</Label>
                <Input
                  value={value.produtoPredominante}
                  onChange={(e) => onChange({ ...value, produtoPredominante: e.target.value })}
                  placeholder="Ex: Alimentos processados"
                />
              </div>

              <div className="space-y-2">
                <Label>Outras Características</Label>
                <Textarea
                  value={value.outraCaracteristica}
                  onChange={(e) => onChange({ ...value, outraCaracteristica: e.target.value })}
                  placeholder="Informações adicionais sobre a carga..."
                  rows={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Peso */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Peso</h4>
            </div>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Peso Bruto (kg) *</Label>
                <Input
                  value={value.pesoBruto}
                  onChange={(e) => onChange({ ...value, pesoBruto: e.target.value.replace(/[^0-9,]/g, '') })}
                  placeholder="0,000"
                />
                <p className="text-xs text-muted-foreground">
                  Peso total incluindo embalagem
                </p>
              </div>

              <div className="space-y-2">
                <Label>Peso Líquido (kg)</Label>
                <Input
                  value={value.pesoLiquido}
                  onChange={(e) => onChange({ ...value, pesoLiquido: e.target.value.replace(/[^0-9,]/g, '') })}
                  placeholder="0,000"
                />
                <p className="text-xs text-muted-foreground">
                  Peso sem embalagem (opcional)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Valor */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Valor da Carga</h4>
            </div>
            
            <div className="space-y-2">
              <Label>Valor Total da Mercadoria (R$) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
                <Input
                  className="pl-10"
                  value={value.valorCarga}
                  onChange={(e) => onChange({ ...value, valorCarga: e.target.value.replace(/[^0-9,]/g, '') })}
                  placeholder="0,00"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Valor declarado para fins de seguro
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quantidade e Dimensões */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Box className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Quantidade e Dimensões</h4>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantidade *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={value.quantidade}
                    onChange={(e) => onChange({ ...value, quantidade: e.target.value })}
                    placeholder="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Unidade *</Label>
                  <Select
                    value={value.unidadeMedida}
                    onValueChange={(unidadeMedida) => onChange({ ...value, unidadeMedida })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDADE_OPTIONS.map((un) => (
                        <SelectItem key={un.value} value={un.value}>
                          {un.label} ({un.value})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cubagem (m³)</Label>
                <Input
                  value={value.cubagem}
                  onChange={(e) => onChange({ ...value, cubagem: e.target.value.replace(/[^0-9,]/g, '') })}
                  placeholder="0,000"
                />
                <p className="text-xs text-muted-foreground">
                  Volume total em metros cúbicos (opcional)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          <strong>Atenção:</strong> Os dados da carga são utilizados para cálculo de frete, 
          seguro e obrigações fiscais. Certifique-se de informar os valores corretamente. 
          Para cargas perigosas, consulte a legislação específica da ANTT.
        </p>
      </div>
    </div>
  );
}

export const emptyCargo: CargoData = {
  natureza: '',
  pesoBruto: '',
  pesoLiquido: '',
  valorCarga: '',
  quantidade: '1',
  unidadeMedida: 'UN',
  cubagem: '',
  produtoPredominante: '',
  outraCaracteristica: ''
};
