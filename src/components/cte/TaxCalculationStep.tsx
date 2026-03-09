import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calculator, Info, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface TaxData {
  cst: string;
  baseCalculo: string;
  aliquota: string;
  valorIcms: string;
  reducaoBaseCalculo: string;
  icmsDevido: string;
  // Simples Nacional
  simplesNacional: boolean;
  // Informações complementares
  observacoesFisco: string;
}

interface TaxCalculationStepProps {
  value: TaxData;
  onChange: (data: TaxData) => void;
  freightValue: string;
  originUf: string;
  destUf: string;
}

const CST_OPTIONS = [
  { value: '00', label: '00 - Tributação normal do ICMS', description: 'ICMS devido normalmente' },
  { value: '20', label: '20 - Tributação com BC reduzida do ICMS', description: 'ICMS com redução de base de cálculo' },
  { value: '40', label: '40 - ICMS isento', description: 'Operação isenta de ICMS' },
  { value: '41', label: '41 - ICMS não tributado', description: 'Operação não tributada' },
  { value: '51', label: '51 - ICMS diferido', description: 'Diferimento do ICMS' },
  { value: '60', label: '60 - ICMS cobrado por ST', description: 'Substituição tributária' },
  { value: '90', label: '90 - ICMS outros', description: 'Outras situações' },
  { value: 'SN', label: 'Simples Nacional', description: 'Optante pelo Simples Nacional' },
];

// Alíquotas por estado (simplificado)
const ALIQUOTAS_INTERESTADUAIS: Record<string, number> = {
  // De Sul/Sudeste para Norte/Nordeste/Centro-Oeste
  'SP-AM': 7, 'SP-BA': 7, 'SP-CE': 7, 'SP-MA': 7, 'SP-PA': 7, 'SP-PE': 7, 
  'SP-PI': 7, 'SP-RN': 7, 'SP-SE': 7, 'SP-AL': 7, 'SP-PB': 7, 'SP-AC': 7,
  'SP-AP': 7, 'SP-RO': 7, 'SP-RR': 7, 'SP-TO': 7, 'SP-MT': 7, 'SP-MS': 7, 'SP-GO': 7, 'SP-DF': 7,
  
  // De Sul/Sudeste para Sul/Sudeste
  'SP-RJ': 12, 'SP-MG': 12, 'SP-ES': 12, 'SP-PR': 12, 'SP-SC': 12, 'SP-RS': 12,
  'RJ-SP': 12, 'MG-SP': 12, 'PR-SP': 12, 'SC-SP': 12, 'RS-SP': 12,
  
  // Operações internas (alíquotas variam por estado)
  'SP-SP': 12, 'RJ-RJ': 18, 'MG-MG': 18, 'PR-PR': 18, 'SC-SC': 17, 'RS-RS': 17,
  'BA-BA': 18, 'PE-PE': 18, 'CE-CE': 18, 'GO-GO': 17, 'MT-MT': 17, 'MS-MS': 17,
};

export function TaxCalculationStep({ 
  value, 
  onChange, 
  freightValue, 
  originUf, 
  destUf 
}: TaxCalculationStepProps) {
  
  // Calcular valores automaticamente
  useEffect(() => {
    if (value.cst === 'SN') {
      // Simples Nacional - não calcula ICMS
      onChange({
        ...value,
        simplesNacional: true,
        baseCalculo: '0',
        aliquota: '0',
        valorIcms: '0',
        icmsDevido: '0'
      });
      return;
    }

    const freight = parseFloat(freightValue.replace(',', '.')) || 0;
    const reducao = parseFloat(value.reducaoBaseCalculo) || 0;
    
    // Base de cálculo
    let baseCalculo = freight;
    if (value.cst === '20') {
      baseCalculo = freight * (1 - reducao / 100);
    }
    
    // Alíquota automática baseada em origem/destino
    let aliquota = parseFloat(value.aliquota) || 0;
    if (!value.aliquota && originUf && destUf) {
      const key = `${originUf}-${destUf}`;
      aliquota = ALIQUOTAS_INTERESTADUAIS[key] || 12;
    }
    
    // Valor do ICMS
    let valorIcms = 0;
    if (['00', '20', '90'].includes(value.cst)) {
      valorIcms = baseCalculo * (aliquota / 100);
    }
    
    // Atualizar apenas se valores mudaram
    const newBaseCalculo = baseCalculo.toFixed(2).replace('.', ',');
    const newAliquota = aliquota.toString();
    const newValorIcms = valorIcms.toFixed(2).replace('.', ',');
    
    if (
      newBaseCalculo !== value.baseCalculo ||
      newAliquota !== value.aliquota ||
      newValorIcms !== value.valorIcms
    ) {
      onChange({
        ...value,
        simplesNacional: false,
        baseCalculo: newBaseCalculo,
        aliquota: newAliquota,
        valorIcms: newValorIcms,
        icmsDevido: ['00', '20', '90'].includes(value.cst) ? newValorIcms : '0'
      });
    }
  }, [value.cst, value.reducaoBaseCalculo, freightValue, originUf, destUf]);

  const handleCstChange = (cst: string) => {
    onChange({
      ...value,
      cst,
      simplesNacional: cst === 'SN'
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="h-5 w-5 text-primary" />
            <h4 className="font-medium">Situação Tributária</h4>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                CST - Código de Situação Tributária *
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>O CST indica como o ICMS será tratado nesta operação de transporte.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Select value={value.cst} onValueChange={handleCstChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o CST" />
                </SelectTrigger>
                <SelectContent>
                  {CST_OPTIONS.map((cst) => (
                    <SelectItem key={cst.value} value={cst.value}>
                      <div className="flex flex-col">
                        <span>{cst.label}</span>
                        <span className="text-xs text-muted-foreground">{cst.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {value.cst === 'SN' && (
              <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700 dark:text-blue-300">
                  <strong>Simples Nacional:</strong> Empresas optantes pelo Simples Nacional 
                  têm tratamento tributário diferenciado. O ICMS é recolhido de forma unificada 
                  através do DAS.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {value.cst !== 'SN' && ['00', '20', '90'].includes(value.cst) && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Cálculo do ICMS</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Valor do Frete</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                  </span>
                  <Input
                    className="pl-10 bg-muted"
                    value={freightValue}
                    readOnly
                  />
                </div>
              </div>

              {value.cst === '20' && (
                <div className="space-y-2">
                  <Label>Redução BC (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={value.reducaoBaseCalculo}
                    onChange={(e) => onChange({ ...value, reducaoBaseCalculo: e.target.value })}
                    placeholder="0"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Base de Cálculo (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                  </span>
                  <Input
                    className="pl-10 bg-muted"
                    value={value.baseCalculo}
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Alíquota (%)
                  {originUf && destUf && (
                    <span className="text-xs text-muted-foreground">
                      ({originUf} → {destUf})
                    </span>
                  )}
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="25"
                  step="0.01"
                  value={value.aliquota}
                  onChange={(e) => onChange({ ...value, aliquota: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Valor do ICMS (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                  </span>
                  <Input
                    className="pl-10 bg-muted font-medium text-primary"
                    value={value.valorIcms}
                    readOnly
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {value.cst && ['40', '41', '51'].includes(value.cst) && (
        <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200">
          <Info className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            <strong>ICMS não devido:</strong> Com o CST selecionado, não há ICMS a recolher 
            nesta operação. Certifique-se de que a operação atende aos requisitos legais 
            para a isenção/não tributação.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="space-y-2">
            <Label>Informações Complementares para o Fisco</Label>
            <textarea
              className="w-full min-h-[80px] p-3 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              value={value.observacoesFisco}
              onChange={(e) => onChange({ ...value, observacoesFisco: e.target.value })}
              placeholder="Informações adicionais para a fiscalização (opcional)..."
            />
            <p className="text-xs text-muted-foreground">
              Utilize este campo para informações obrigatórias por legislação específica
            </p>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Atenção:</strong> Os cálculos de ICMS são realizados automaticamente com base 
          nas UFs de origem e destino. Consulte seu contador para confirmar a correta 
          tributação da operação. Alíquotas podem variar conforme convênios e protocolos ICMS.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export const emptyTax: TaxData = {
  cst: '00',
  baseCalculo: '',
  aliquota: '',
  valorIcms: '',
  reducaoBaseCalculo: '0',
  icmsDevido: '',
  simplesNacional: false,
  observacoesFisco: ''
};
