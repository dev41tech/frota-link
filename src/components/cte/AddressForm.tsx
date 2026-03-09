import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface AddressData {
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  codigoIBGE: string;
  uf: string;
  cep: string;
  ie?: string;
}

interface AddressFormProps {
  value: AddressData;
  onChange: (data: AddressData) => void;
  label: string;
  showIE?: boolean;
}

const UF_OPTIONS = [
  { value: 'AC', label: 'Acre', codigo: '12' },
  { value: 'AL', label: 'Alagoas', codigo: '27' },
  { value: 'AP', label: 'Amapá', codigo: '16' },
  { value: 'AM', label: 'Amazonas', codigo: '13' },
  { value: 'BA', label: 'Bahia', codigo: '29' },
  { value: 'CE', label: 'Ceará', codigo: '23' },
  { value: 'DF', label: 'Distrito Federal', codigo: '53' },
  { value: 'ES', label: 'Espírito Santo', codigo: '32' },
  { value: 'GO', label: 'Goiás', codigo: '52' },
  { value: 'MA', label: 'Maranhão', codigo: '21' },
  { value: 'MT', label: 'Mato Grosso', codigo: '51' },
  { value: 'MS', label: 'Mato Grosso do Sul', codigo: '50' },
  { value: 'MG', label: 'Minas Gerais', codigo: '31' },
  { value: 'PA', label: 'Pará', codigo: '15' },
  { value: 'PB', label: 'Paraíba', codigo: '25' },
  { value: 'PR', label: 'Paraná', codigo: '41' },
  { value: 'PE', label: 'Pernambuco', codigo: '26' },
  { value: 'PI', label: 'Piauí', codigo: '22' },
  { value: 'RJ', label: 'Rio de Janeiro', codigo: '33' },
  { value: 'RN', label: 'Rio Grande do Norte', codigo: '24' },
  { value: 'RS', label: 'Rio Grande do Sul', codigo: '43' },
  { value: 'RO', label: 'Rondônia', codigo: '11' },
  { value: 'RR', label: 'Roraima', codigo: '14' },
  { value: 'SC', label: 'Santa Catarina', codigo: '42' },
  { value: 'SP', label: 'São Paulo', codigo: '35' },
  { value: 'SE', label: 'Sergipe', codigo: '28' },
  { value: 'TO', label: 'Tocantins', codigo: '17' },
];

export function AddressForm({ value, onChange, label, showIE = false }: AddressFormProps) {
  const [loadingCep, setLoadingCep] = useState(false);
  const { toast } = useToast();

  const handleCepSearch = async () => {
    const cepClean = value.cep.replace(/\D/g, '');
    if (cepClean.length !== 8) {
      toast({
        title: 'CEP inválido',
        description: 'Digite um CEP com 8 dígitos',
        variant: 'destructive'
      });
      return;
    }

    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepClean}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast({
          title: 'CEP não encontrado',
          description: 'Verifique o CEP informado',
          variant: 'destructive'
        });
        return;
      }

      onChange({
        ...value,
        logradouro: data.logradouro || value.logradouro,
        bairro: data.bairro || value.bairro,
        cidade: data.localidade || value.cidade,
        uf: data.uf || value.uf,
        codigoIBGE: data.ibge || value.codigoIBGE,
        complemento: data.complemento || value.complemento
      });

      toast({
        title: 'Endereço encontrado',
        description: `${data.localidade} - ${data.uf}`
      });
    } catch (error) {
      toast({
        title: 'Erro ao buscar CEP',
        description: 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setLoadingCep(false);
    }
  };

  const formatCep = (cep: string) => {
    const cleaned = cep.replace(/\D/g, '');
    if (cleaned.length <= 5) return cleaned;
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 8)}`;
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h4 className="font-medium text-sm text-muted-foreground">{label}</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>CEP *</Label>
          <div className="flex gap-2">
            <Input
              value={formatCep(value.cep)}
              onChange={(e) => onChange({ ...value, cep: e.target.value.replace(/\D/g, '') })}
              placeholder="00000-000"
              maxLength={9}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCepSearch}
              disabled={loadingCep}
            >
              {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Logradouro *</Label>
          <Input
            value={value.logradouro}
            onChange={(e) => onChange({ ...value, logradouro: e.target.value })}
            placeholder="Rua, Avenida, etc."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Número *</Label>
          <Input
            value={value.numero}
            onChange={(e) => onChange({ ...value, numero: e.target.value })}
            placeholder="123"
          />
        </div>

        <div className="space-y-2">
          <Label>Complemento</Label>
          <Input
            value={value.complemento}
            onChange={(e) => onChange({ ...value, complemento: e.target.value })}
            placeholder="Sala, Andar, etc."
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Bairro *</Label>
          <Input
            value={value.bairro}
            onChange={(e) => onChange({ ...value, bairro: e.target.value })}
            placeholder="Nome do bairro"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label>Cidade *</Label>
          <Input
            value={value.cidade}
            onChange={(e) => onChange({ ...value, cidade: e.target.value })}
            placeholder="Nome da cidade"
          />
        </div>

        <div className="space-y-2">
          <Label>UF *</Label>
          <Select
            value={value.uf}
            onValueChange={(uf) => {
              const ufData = UF_OPTIONS.find(u => u.value === uf);
              onChange({ 
                ...value, 
                uf,
                // Update IBGE prefix when UF changes (first 2 digits)
                codigoIBGE: ufData ? `${ufData.codigo}${value.codigoIBGE.slice(2)}` : value.codigoIBGE
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {UF_OPTIONS.map((uf) => (
                <SelectItem key={uf.value} value={uf.value}>
                  {uf.value} - {uf.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Código IBGE *</Label>
          <Input
            value={value.codigoIBGE}
            onChange={(e) => onChange({ ...value, codigoIBGE: e.target.value.replace(/\D/g, '') })}
            placeholder="0000000"
            maxLength={7}
          />
          <p className="text-xs text-muted-foreground">7 dígitos</p>
        </div>
      </div>

      {showIE && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Inscrição Estadual (IE)</Label>
            <Input
              value={value.ie || ''}
              onChange={(e) => onChange({ ...value, ie: e.target.value })}
              placeholder="Número da IE ou ISENTO"
            />
            <p className="text-xs text-muted-foreground">Deixe vazio ou digite ISENTO se não contribuinte</p>
          </div>
        </div>
      )}
    </div>
  );
}

export const emptyAddress: AddressData = {
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  codigoIBGE: '',
  uf: '',
  cep: '',
  ie: ''
};
