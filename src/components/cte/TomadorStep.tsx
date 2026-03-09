import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { User, Building2, Truck, Package } from 'lucide-react';
import { AddressForm, AddressData, emptyAddress } from './AddressForm';

export type TomadorType = 'remetente' | 'expedidor' | 'recebedor' | 'destinatario' | 'outros';

export interface TomadorData {
  tipo: TomadorType;
  // Dados extras quando tipo = 'outros'
  outrosNome: string;
  outrosDocumento: string;
  outrosEndereco: AddressData;
}

interface TomadorStepProps {
  value: TomadorData;
  onChange: (data: TomadorData) => void;
}

const TOMADOR_OPTIONS = [
  { 
    value: 'remetente' as TomadorType, 
    label: 'Remetente', 
    description: 'Quem envia a carga',
    icon: Building2,
    codigo: '0'
  },
  { 
    value: 'expedidor' as TomadorType, 
    label: 'Expedidor', 
    description: 'Quem despacha a carga (quando diferente do remetente)',
    icon: Package,
    codigo: '1'
  },
  { 
    value: 'recebedor' as TomadorType, 
    label: 'Recebedor', 
    description: 'Quem recebe a carga (quando diferente do destinatário)',
    icon: Truck,
    codigo: '2'
  },
  { 
    value: 'destinatario' as TomadorType, 
    label: 'Destinatário', 
    description: 'Quem é o destino final da carga',
    icon: User,
    codigo: '3'
  },
  { 
    value: 'outros' as TomadorType, 
    label: 'Outros', 
    description: 'Terceiro não listado acima',
    icon: User,
    codigo: '4'
  },
];

export function TomadorStep({ value, onChange }: TomadorStepProps) {
  const formatDocument = (doc: string) => {
    const cleaned = doc.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      // CPF
      return cleaned
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    // CNPJ
    return cleaned
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold">Tomador do Serviço *</Label>
        <p className="text-sm text-muted-foreground mb-4">
          Quem é responsável pelo pagamento do frete?
        </p>
        
        <RadioGroup
          value={value.tipo}
          onValueChange={(tipo: TomadorType) => onChange({ ...value, tipo })}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {TOMADOR_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <Card 
                key={option.value}
                className={`cursor-pointer transition-all ${
                  value.tipo === option.value 
                    ? 'border-primary ring-2 ring-primary/20' 
                    : 'hover:border-muted-foreground/50'
                }`}
                onClick={() => onChange({ ...value, tipo: option.value })}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor={option.value} className="font-medium cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {option.description}
                    </p>
                    <span className="text-xs text-muted-foreground/70">
                      Código SEFAZ: {option.codigo}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </RadioGroup>
      </div>

      {value.tipo === 'outros' && (
        <div className="space-y-4 mt-6 p-4 bg-muted/30 rounded-lg">
          <h4 className="font-medium">Dados do Tomador (Outros)</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome/Razão Social *</Label>
              <Input
                value={value.outrosNome}
                onChange={(e) => onChange({ ...value, outrosNome: e.target.value })}
                placeholder="Nome completo ou razão social"
              />
            </div>
            
            <div className="space-y-2">
              <Label>CPF/CNPJ *</Label>
              <Input
                value={formatDocument(value.outrosDocumento)}
                onChange={(e) => onChange({ 
                  ...value, 
                  outrosDocumento: e.target.value.replace(/\D/g, '') 
                })}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                maxLength={18}
              />
            </div>
          </div>

          <AddressForm
            label="Endereço do Tomador"
            value={value.outrosEndereco}
            onChange={(outrosEndereco) => onChange({ ...value, outrosEndereco })}
            showIE={true}
          />
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Importante:</strong> O tomador do serviço é quem contrata e paga pelo frete. 
          Esta informação é obrigatória para emissão do CT-e e determina aspectos fiscais como 
          a responsabilidade pelo ICMS.
        </p>
      </div>
    </div>
  );
}

export const emptyTomador: TomadorData = {
  tipo: 'remetente',
  outrosNome: '',
  outrosDocumento: '',
  outrosEndereco: emptyAddress
};
