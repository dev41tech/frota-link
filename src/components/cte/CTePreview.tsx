import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  ChevronLeft, 
  Send, 
  Loader2, 
  Eye, 
  Info, 
  FileText, 
  Building, 
  User, 
  Package, 
  Truck, 
  DollarSign, 
  Calculator, 
  Link,
  Save,
  FileSearch
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AddressData } from './AddressForm';
import { TomadorData } from './TomadorStep';
import { CargoData } from './CargoInfoStep';
import { VehicleDriverData } from './VehicleDriverStep';
import { TaxData } from './TaxCalculationStep';
import { LinkedDocument } from './LinkedDocumentsManager';

interface PartyData {
  nome: string;
  documento: string;
  ie: string;
  endereco: AddressData;
}

interface CTeFormData {
  operationType: string;
  emissionType: 'production' | 'draft';
  sender: PartyData;
  recipient: PartyData;
  tomador: TomadorData;
  cargo: CargoData;
  vehicleDriver: VehicleDriverData;
  linkedDocuments: LinkedDocument[];
  freightValue: string;
  cfop: string;
  taxes: TaxData;
  notes: string;
  dataSource: 'manual' | 'import' | 'upload';
  importedDocumentKey: string;
}

interface CTePreviewProps {
  formData: CTeFormData;
  onEmit: () => void;
  onSaveDraft: () => void;
  onBack: () => void;
  loading: boolean;
  loadingType?: 'emit' | 'draft' | null;
  onGeneratePreviewPayload?: () => Record<string, unknown>;
}

function PreviewSection({ 
  title, 
  icon: Icon, 
  children 
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-1 text-sm">
        {children}
      </CardContent>
    </Card>
  );
}

function PreviewRow({ 
  label, 
  value, 
  highlight = false, 
  monospace = false,
  fullWidth = false
}: { 
  label: string; 
  value: string | number | null | undefined; 
  highlight?: boolean;
  monospace?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn(
      "flex justify-between py-1 border-b last:border-0 gap-2",
      highlight && "bg-amber-50 dark:bg-amber-950/30 -mx-2 px-2 rounded",
      fullWidth && "md:col-span-2"
    )}>
      <span className="text-muted-foreground whitespace-nowrap">{label}:</span>
      <span className={cn(
        "font-medium text-right break-all",
        monospace && "font-mono text-xs"
      )}>
        {value || '-'}
      </span>
    </div>
  );
}

function getTipoServico(operationType: string): string {
  switch (operationType) {
    case 'subcontratacao': return '1 - Subcontratação';
    case 'redespacho': return '2 - Redespacho';
    case 'redespacho_intermediario': return '3 - Redespacho Intermediário';
    default: return '0 - Normal';
  }
}

function getTomadorIndicador(tipo: string): string {
  switch (tipo) {
    case 'remetente': return '0 - Remetente';
    case 'expedidor': return '1 - Expedidor';
    case 'recebedor': return '2 - Recebedor';
    case 'destinatario': return '3 - Destinatário';
    case 'outros': return '4 - Outros';
    default: return '0 - Remetente';
  }
}

function mapUnidadeMedidaLabel(unidade: string): string {
  switch (unidade?.toLowerCase()) {
    case 'kg': return '01 - KG (Quilograma)';
    case 'ton': return '02 - TON (Tonelada)';
    case 'litro': case 'l': return '03 - LITRO';
    case 'm3': return '04 - M³ (Metro Cúbico)';
    case 'un': return '00 - Unidade';
    default: return '01 - KG (Quilograma)';
  }
}

function formatNumber(value: string | number | undefined): string {
  if (!value) return '0,00';
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDocument(doc: string): string {
  const cleaned = doc?.replace(/\D/g, '') || '';
  if (cleaned.length <= 11) {
    return cleaned
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return cleaned
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function CTePreview({ formData, onEmit, onSaveDraft, onBack, loading, loadingType, onGeneratePreviewPayload }: CTePreviewProps) {
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleGeneratePreview = async () => {
    if (!onGeneratePreviewPayload) {
      toast.error('Função de prévia não disponível');
      return;
    }

    setPreviewLoading(true);
    try {
      const payload = onGeneratePreviewPayload();
      
      // Forçar ambiente de homologação para a prévia
      const previewPayload = {
        ...payload,
        is_draft: true, // Força homologação
      };

      const { data, error } = await supabase.functions.invoke('cte-issue', {
        body: previewPayload,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Buscar PDF do CT-e gerado
      if (data?.cte?.id) {
        // Aguardar um pouco para o PDF ser gerado
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const { data: pdfData, error: pdfError } = await supabase.functions.invoke('cte-download', {
          body: { 
            cte_id: data.cte.id,
            format: 'pdf'
          },
        });

        if (pdfError) throw pdfError;
        
        if (pdfData?.pdf_url) {
          setPreviewPdfUrl(pdfData.pdf_url);
          setPreviewOpen(true);
        } else if (data?.cte?.url_pdf) {
          setPreviewPdfUrl(data.cte.url_pdf);
          setPreviewOpen(true);
        } else {
          toast.info('CT-e gerado em homologação! PDF sendo processado...');
          // Tentar buscar diretamente da resposta
          if (data?.cte?.autorizacao?.url_dacte) {
            setPreviewPdfUrl(data.cte.autorizacao.url_dacte);
            setPreviewOpen(true);
          }
        }
      }

      toast.success('Prévia gerada em ambiente de homologação');
    } catch (error: any) {
      console.error('Erro ao gerar prévia:', error);
      toast.error(`Erro ao gerar prévia: ${error.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Eye className="h-5 w-5" />
        Pré-Visualização - Dados para SEFAZ
      </div>

      <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          Revise todos os dados abaixo. Estes são os valores exatos que serão 
          transmitidos à SEFAZ. Erros podem causar rejeição do documento.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Identificação do CT-e */}
        <PreviewSection title="Identificação do CT-e" icon={FileText}>
          <PreviewRow label="Tipo CT-e" value="0 - CT-e Normal" />
          <PreviewRow label="Modal" value="1 - Rodoviário" />
          <PreviewRow label="Tipo Serviço" value={getTipoServico(formData.operationType)} />
          <PreviewRow label="CFOP" value={formData.cfop} highlight />
          <PreviewRow label="Ambiente" value="1 - Produção" />
          <PreviewRow label="Natureza Operação" value="PRESTACAO DE SERVICO DE TRANSPORTE" fullWidth />
        </PreviewSection>

        {/* Tomador */}
        <PreviewSection title="Tomador do Serviço" icon={User}>
          <PreviewRow label="Indicador" value={getTomadorIndicador(formData.tomador.tipo)} />
          {formData.tomador.tipo === 'outros' && (
            <>
              <PreviewRow label="Nome" value={formData.tomador.outrosNome} />
              <PreviewRow label="CPF/CNPJ" value={formatDocument(formData.tomador.outrosDocumento)} />
            </>
          )}
        </PreviewSection>

        {/* Remetente */}
        <PreviewSection title="Remetente" icon={Building}>
          <PreviewRow label="CPF/CNPJ" value={formatDocument(formData.sender.documento)} highlight />
          <PreviewRow label="Razão Social" value={formData.sender.nome} />
          <PreviewRow label="IE" value={formData.sender.ie || 'ISENTO'} />
          <PreviewRow label="Logradouro" value={formData.sender.endereco.logradouro} />
          <PreviewRow label="Número" value={formData.sender.endereco.numero || 'S/N'} />
          <PreviewRow label="Complemento" value={formData.sender.endereco.complemento} />
          <PreviewRow label="Bairro" value={formData.sender.endereco.bairro} />
          <PreviewRow label="Código IBGE" value={formData.sender.endereco.codigoIBGE} highlight />
          <PreviewRow label="Município" value={formData.sender.endereco.cidade} />
          <PreviewRow label="UF" value={formData.sender.endereco.uf} />
          <PreviewRow label="CEP" value={formData.sender.endereco.cep} />
        </PreviewSection>

        {/* Destinatário */}
        <PreviewSection title="Destinatário" icon={Building}>
          <PreviewRow label="CPF/CNPJ" value={formatDocument(formData.recipient.documento)} highlight />
          <PreviewRow label="Razão Social" value={formData.recipient.nome} />
          <PreviewRow label="IE" value={formData.recipient.ie || 'ISENTO'} />
          <PreviewRow label="Logradouro" value={formData.recipient.endereco.logradouro} />
          <PreviewRow label="Número" value={formData.recipient.endereco.numero || 'S/N'} />
          <PreviewRow label="Complemento" value={formData.recipient.endereco.complemento} />
          <PreviewRow label="Bairro" value={formData.recipient.endereco.bairro} />
          <PreviewRow label="Código IBGE" value={formData.recipient.endereco.codigoIBGE} highlight />
          <PreviewRow label="Município" value={formData.recipient.endereco.cidade} />
          <PreviewRow label="UF" value={formData.recipient.endereco.uf} />
          <PreviewRow label="CEP" value={formData.recipient.endereco.cep} />
        </PreviewSection>

        {/* Carga */}
        <PreviewSection title="Informações da Carga" icon={Package}>
          <PreviewRow label="Produto Predominante" value={formData.cargo.produtoPredominante || formData.cargo.natureza} />
          <PreviewRow label="Valor da Carga (R$)" value={formatNumber(formData.cargo.valorCarga)} highlight />
          <PreviewRow label="Unidade Medida" value={mapUnidadeMedidaLabel(formData.cargo.unidadeMedida)} />
          <PreviewRow label="Peso Bruto (kg)" value={formData.cargo.pesoBruto} />
          <PreviewRow label="Peso Líquido (kg)" value={formData.cargo.pesoLiquido} />
          <PreviewRow label="Quantidade" value={formData.cargo.quantidade} />
          {formData.cargo.cubagem && (
            <PreviewRow label="Cubagem (m³)" value={formData.cargo.cubagem} />
          )}
        </PreviewSection>

        {/* Veículo e Motorista */}
        <PreviewSection title="Modal Rodoviário" icon={Truck}>
          <PreviewRow label="RNTRC" value={formData.vehicleDriver.vehicleRntrc} highlight />
          <PreviewRow label="Placa" value={formData.vehicleDriver.vehiclePlate?.toUpperCase()} />
          <PreviewRow label="UF Veículo" value={formData.vehicleDriver.vehicleUf} />
          <PreviewRow label="RENAVAM" value={formData.vehicleDriver.vehicleRenavam} />
          <PreviewRow label="Tara (kg)" value={formData.vehicleDriver.vehicleTara} />
          <PreviewRow label="Capacidade (kg)" value={formData.vehicleDriver.vehicleCapacidade} />
          <PreviewRow label="Motorista" value={formData.vehicleDriver.driverName} />
          <PreviewRow label="CPF Motorista" value={formatDocument(formData.vehicleDriver.driverCpf)} />
        </PreviewSection>

        {/* Valores */}
        <PreviewSection title="Valores do Serviço" icon={DollarSign}>
          <PreviewRow label="Valor Total do Frete (R$)" value={formatNumber(formData.freightValue)} highlight />
          <PreviewRow label="Valor a Receber (R$)" value={formatNumber(formData.freightValue)} />
        </PreviewSection>

        {/* Impostos */}
        <PreviewSection title="ICMS" icon={Calculator}>
          {formData.taxes.simplesNacional ? (
            <>
              <PreviewRow label="Regime" value="Simples Nacional" highlight />
              <PreviewRow label="CST" value="90" />
              <PreviewRow label="indSN" value="1" />
            </>
          ) : (
            <>
              <PreviewRow label="CST" value={formData.taxes.cst} />
              <PreviewRow label="Base de Cálculo (R$)" value={formatNumber(formData.taxes.baseCalculo)} />
              <PreviewRow label="Alíquota (%)" value={formData.taxes.aliquota} />
              <PreviewRow label="Valor ICMS (R$)" value={formatNumber(formData.taxes.valorIcms)} highlight />
            </>
          )}
        </PreviewSection>
      </div>

      {/* Documentos Vinculados */}
      {formData.linkedDocuments.length > 0 && (
        <PreviewSection title="Documentos Fiscais Vinculados" icon={Link}>
          {formData.linkedDocuments.map((doc, i) => (
            <div key={i} className="md:col-span-2 border rounded p-3 space-y-1">
              <PreviewRow label="Tipo" value={doc.type === 'nfe' ? 'NF-e' : 'CT-e'} />
              <PreviewRow 
                label="Chave de Acesso (44 dígitos)" 
                value={doc.key} 
                monospace 
                fullWidth 
              />
              {doc.number && <PreviewRow label="Número" value={doc.number} />}
              {doc.series && <PreviewRow label="Série" value={doc.series} />}
            </div>
          ))}
        </PreviewSection>
      )}

      {/* Observações */}
      {formData.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Observações Complementares
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {formData.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Botões de Ação */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4 border-t">
        <Button variant="outline" onClick={onBack} disabled={loading || previewLoading}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Voltar e Editar
        </Button>
        
        <div className="flex flex-wrap gap-2">
          {onGeneratePreviewPayload && (
            <Button 
              variant="secondary"
              onClick={handleGeneratePreview}
              disabled={loading || previewLoading}
            >
              {previewLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileSearch className="h-4 w-4 mr-2" />
              )}
              Visualizar Prévia (PDF)
            </Button>
          )}
          
          <Button 
            variant="outline"
            onClick={onSaveDraft} 
            disabled={loading || previewLoading}
          >
            {loadingType === 'draft' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Rascunho
          </Button>
          
          <Button 
            onClick={onEmit} 
            disabled={loading || previewLoading}
          >
            {loadingType === 'emit' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Emitir CT-e
          </Button>
        </div>
      </div>

      {/* Modal de Prévia do DACTE */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              Prévia do CT-e (Homologação)
            </DialogTitle>
            <DialogDescription>
              Este documento foi gerado em <strong>ambiente de teste</strong> e contém a marca 
              "SEM VALOR FISCAL". Verifique se os dados estão corretos antes de emitir em produção.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 min-h-0">
            {previewPdfUrl ? (
              <iframe 
                src={previewPdfUrl} 
                className="w-full h-full border rounded"
                title="Prévia DACTE"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mr-2" />
                Carregando PDF...
              </div>
            )}
          </div>
          
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Voltar e Editar
            </Button>
            <Button onClick={() => { setPreviewOpen(false); onEmit(); }}>
              <Send className="h-4 w-4 mr-2" />
              Confirmar e Emitir (Produção)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
