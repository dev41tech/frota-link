import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, FileText, AlertCircle } from 'lucide-react';

export interface MDFeSeguroData {
  seguroResponsavel: string;
  seguradoraCnpj: string;
  apolice: string;
  averbacao: string;
  ciot: string;
  valeCodigo: string;
}

interface MDFeSeguroStepProps {
  value: MDFeSeguroData;
  onChange: (data: MDFeSeguroData) => void;
  totalValue: number;
}

export function MDFeSeguroStep({ value, onChange, totalValue }: MDFeSeguroStepProps) {
  const formatCnpj = (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, '');
    return cleaned
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };

  const responsavelOptions = [
    { value: '0', label: 'Remetente' },
    { value: '1', label: 'Expedidor' },
    { value: '2', label: 'Recebedor' },
    { value: '3', label: 'Destinatário' },
    { value: '4', label: 'Emitente do MDF-e' },
    { value: '5', label: 'Tomador do Serviço' }
  ];

  return (
    <div className="space-y-6">
      {/* Seguro */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h4 className="font-medium">Dados do Seguro</h4>
          </div>

          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              O seguro é obrigatório quando o valor da carga ultrapassa determinados limites. 
              Valor total da carga: <strong>R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Responsável pelo Seguro *</Label>
              <Select
                value={value.seguroResponsavel}
                onValueChange={(v) => onChange({ ...value, seguroResponsavel: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {responsavelOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>CNPJ da Seguradora</Label>
              <Input
                value={formatCnpj(value.seguradoraCnpj)}
                onChange={(e) => onChange({ 
                  ...value, 
                  seguradoraCnpj: e.target.value.replace(/\D/g, '') 
                })}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
            </div>

            <div className="space-y-2">
              <Label>Número da Apólice</Label>
              <Input
                value={value.apolice}
                onChange={(e) => onChange({ ...value, apolice: e.target.value })}
                placeholder="Número da apólice de seguro"
              />
            </div>

            <div className="space-y-2">
              <Label>Número da Averbação</Label>
              <Input
                value={value.averbacao}
                onChange={(e) => onChange({ ...value, averbacao: e.target.value })}
                placeholder="Número da averbação"
              />
              <p className="text-xs text-muted-foreground">
                Obrigatório para cargas acima de R$ 100.000,00
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CIOT */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-primary" />
            <h4 className="font-medium">CIOT - Código Identificador da Operação de Transporte</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Número do CIOT</Label>
              <Input
                value={value.ciot}
                onChange={(e) => onChange({ 
                  ...value, 
                  ciot: e.target.value.replace(/\D/g, '') 
                })}
                placeholder="000000000000"
                maxLength={12}
              />
              <p className="text-xs text-muted-foreground">
                Obrigatório para operações de transporte de cargas sob o regime de frete
              </p>
            </div>

            <div className="space-y-2">
              <Label>Vale Pedágio (código)</Label>
              <Input
                value={value.valeCodigo}
                onChange={(e) => onChange({ ...value, valeCodigo: e.target.value })}
                placeholder="Código do vale pedágio (se houver)"
              />
              <p className="text-xs text-muted-foreground">
                Opcional - informar se utilizar vale pedágio obrigatório
              </p>
            </div>
          </div>

          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Quando o CIOT é obrigatório:</strong>
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>Transporte rodoviário de cargas por conta de terceiros</li>
                <li>Transporte rodoviário de cargas próprias cuja receita bruta anual supere R$ 36 milhões</li>
                <li>Operações interestaduais com veículos de terceiros</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

export const emptySeguroData: MDFeSeguroData = {
  seguroResponsavel: '4', // Emitente do MDF-e
  seguradoraCnpj: '',
  apolice: '',
  averbacao: '',
  ciot: '',
  valeCodigo: ''
};
