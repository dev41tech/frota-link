import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, CheckCircle, Info, Edit, Upload, FileUp, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { validateAccessKeyCheckDigit, formatDocument, extractNumberFromKey, extractSeriesFromKey } from '@/lib/xmlParser';
import { parseNFeXml, detectXmlDocumentType } from '@/lib/nfeXmlParser';
import { parseCTeXml } from '@/lib/cteXmlParser';

interface DocumentLookupStepProps {
  onDataImported: (data: any) => void;
  onModeSelected: (mode: 'manual' | 'import' | 'upload') => void;
  selectedMode?: 'manual' | 'import' | 'upload';
}

export function DocumentLookupStep({ onDataImported, onModeSelected, selectedMode }: DocumentLookupStepProps) {
  const [importAccessKey, setImportAccessKey] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [accessKeyError, setAccessKeyError] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLookupDocument = async () => {
    try {
      setLookupLoading(true);
      setAccessKeyError('');

      // Validate format
      if (!/^\d{44}$/.test(importAccessKey)) {
        setAccessKeyError('Chave de acesso inválida. Deve ter 44 dígitos numéricos.');
        return;
      }

      // Validate check digit
      if (!validateAccessKeyCheckDigit(importAccessKey)) {
        setAccessKeyError('Dígito verificador inválido.');
        return;
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke('fiscal-document-lookup', {
        body: { accessKey: importAccessKey }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao consultar chave de acesso');
      }

      setLookupResult(data);

      // Prepare data for form population
      const parsedData = data.parsedData;
      const formattedData = {
        operationType: parsedData.suggestedOperationType,
        senderName: parsedData.emitter?.razaoSocial || '',
        senderDocument: formatDocument(parsedData.emitter?.cnpj || ''),
        senderAddress: formatAddressString(parsedData.emitter?.endereco),
        recipientName: parsedData.recipient?.nome || '',
        recipientDocument: formatDocument(parsedData.recipient?.document || ''),
        recipientAddress: formatAddressString(parsedData.recipient?.endereco),
        freightValue: parsedData.values?.freight || parsedData.values?.total || 0,
        cfop: parsedData.cfop || '',
        linkedDocuments: [{
          type: data.documentType,
          key: parsedData.accessKey,
          number: extractNumberFromKey(parsedData.accessKey),
          series: extractSeriesFromKey(parsedData.accessKey),
          value: parsedData.values?.total || 0,
        }],
        dataSource: 'import' as const,
        importedDocumentKey: importAccessKey
      };

      onDataImported(formattedData);

      toast.success('Dados importados com sucesso!', {
        description: 'Revise os dados antes de emitir o CT-e'
      });

    } catch (error: any) {
      console.error('Lookup error:', error);
      setAccessKeyError(error.message || 'Erro ao consultar chave de acesso');
      toast.error('Erro na consulta', {
        description: 'Não foi possível buscar os dados da SEFAZ'
      });
    } finally {
      setLookupLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande', {
        description: 'O arquivo XML deve ter no máximo 5MB'
      });
      return;
    }

    setUploadedFile(file);
    setLookupLoading(true);
    setUploadResult(null);

    try {
      const xmlContent = await file.text();
      
      // Detect document type
      const docType = detectXmlDocumentType(xmlContent);

      if (!docType) {
        throw new Error('Arquivo XML não reconhecido. Use NF-e ou CT-e válido.');
      }

      if (docType === 'nfe') {
        const parsed = parseNFeXml(xmlContent);
        if (!parsed) {
          // Diagnóstico adicional para mensagem específica
          const hasInfNFe = xmlContent.includes('infNFe');
          const hasNNF = xmlContent.includes('<nNF>') || xmlContent.includes(':nNF>');
          const hasNFe = xmlContent.includes('<NFe') || xmlContent.includes('<nfeProc');
          
          let detailedError = 'Erro ao processar XML da NF-e. ';
          if (!hasNFe && !hasInfNFe) {
            detailedError += 'O arquivo não parece ser um XML de NF-e válido.';
          } else if (!hasInfNFe) {
            detailedError += 'Elemento infNFe não encontrado.';
          } else if (!hasNNF) {
            detailedError += 'Número da NF-e não encontrado no XML.';
          } else {
            detailedError += 'Estrutura do XML não reconhecida. Tente exportar novamente do emissor fiscal.';
          }
          
          throw new Error(detailedError);
        }

        setUploadResult({
          type: 'nfe',
          data: parsed,
          operationType: 'normal'
        });

        // Map NF-e data to form
        const formattedData = {
          operationType: 'normal',
          sender: {
            nome: parsed.emitter.name,
            documento: parsed.emitter.cnpj,
            ie: parsed.emitter.ie,
            endereco: parsed.emitter.address
          },
          recipient: {
            nome: parsed.recipient.name,
            documento: parsed.recipient.document,
            ie: parsed.recipient.ie,
            endereco: parsed.recipient.address
          },
          cargo: {
            natureza: 'MERCADORIAS',
            pesoBruto: parsed.totals.totalWeight.toString(),
            pesoLiquido: '',
            valorCarga: parsed.totals.products.toFixed(2),
            quantidade: parsed.items.length.toString(),
            unidadeMedida: 'VOLUMES',
            cubagem: '',
            produtoPredominante: parsed.items[0]?.description || ''
          },
          linkedDocuments: [{
            type: 'nfe' as const,
            key: parsed.accessKey,
            number: parsed.nfeNumber,
            series: parsed.series,
            value: parsed.totals.total
          }],
          cfop: '',
          freightValue: parsed.totals.freight > 0 ? parsed.totals.freight.toFixed(2) : '',
          dataSource: 'upload' as const,
          importedDocumentKey: parsed.accessKey
        };

        onDataImported(formattedData);
        toast.success('NF-e importada com sucesso!', {
          description: 'Revise os dados antes de continuar'
        });

      } else if (docType === 'cte') {
        const parsed = parseCTeXml(xmlContent);
        if (!parsed) throw new Error('Erro ao processar XML do CT-e');

        setUploadResult({
          type: 'cte',
          data: parsed,
          operationType: 'subcontratacao'
        });

        // Map CT-e data to form for contra CT-e (subcontratação)
        const formattedData = {
          operationType: 'subcontratacao',
          sender: {
            nome: parsed.sender.name,
            documento: parsed.sender.cnpj,
            ie: parsed.sender.ie,
            endereco: parsed.sender.address
          },
          recipient: {
            nome: parsed.recipient.name,
            documento: parsed.recipient.cnpj,
            ie: parsed.recipient.ie,
            endereco: parsed.recipient.address
          },
          cargo: {
            natureza: parsed.naturezaCarga || 'MERCADORIAS',
            pesoBruto: '',
            pesoLiquido: '',
            valorCarga: parsed.values.freightTotal.toFixed(2),
            quantidade: '1',
            unidadeMedida: 'VOLUMES',
            cubagem: '',
            produtoPredominante: ''
          },
          linkedDocuments: [{
            type: 'cte' as const,
            key: parsed.accessKey,
            number: parsed.cteNumber,
            series: parsed.series,
            value: parsed.values.freightTotal
          }],
          cfop: parsed.cfop || '',
          freightValue: parsed.values.freightTotal.toFixed(2),
          dataSource: 'upload' as const,
          importedDocumentKey: parsed.accessKey
        };

        onDataImported(formattedData);
        toast.success('CT-e importado! Modo subcontratação ativado.', {
          description: 'Ajuste o valor do frete e complete os dados do veículo'
        });
      }

    } catch (error: any) {
      console.error('File upload error:', error);
      toast.error('Erro ao processar XML', {
        description: error.message
      });
      setUploadedFile(null);
      setUploadResult(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.xml')) {
        // Create a synthetic event to reuse the handler
        const syntheticEvent = {
          target: { files: [file] }
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleFileUpload(syntheticEvent);
      } else {
        toast.error('Formato inválido', {
          description: 'Por favor, selecione um arquivo XML'
        });
      }
    }
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatAddressString = (address: any): string => {
    if (!address) return '';
    const parts = [
      address.logradouro,
      address.numero,
      address.complemento,
      address.bairro,
      address.municipio || address.cidade,
      address.uf,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className={`cursor-pointer transition ${selectedMode === 'manual' ? 'border-primary ring-2 ring-primary' : 'hover:border-primary'}`}
          onClick={() => onModeSelected('manual')}
        >
          <CardHeader>
            <Edit className="h-8 w-8 mb-2" />
            <CardTitle className="text-base">Preenchimento Manual</CardTitle>
            <CardDescription>
              Preencha todos os dados manualmente
            </CardDescription>
          </CardHeader>
        </Card>

        <Card 
          className={`cursor-pointer transition ${selectedMode === 'import' ? 'border-primary ring-2 ring-primary' : 'hover:border-primary'}`}
          onClick={() => onModeSelected('import')}
        >
          <CardHeader>
            <Search className="h-8 w-8 mb-2" />
            <CardTitle className="text-base">Buscar por Chave</CardTitle>
            <CardDescription>
              Consulte na SEFAZ via chave de acesso
            </CardDescription>
          </CardHeader>
        </Card>

        <Card 
          className={`cursor-pointer transition ${selectedMode === 'upload' ? 'border-primary ring-2 ring-primary' : 'hover:border-primary'}`}
          onClick={() => onModeSelected('upload')}
        >
          <CardHeader>
            <Upload className="h-8 w-8 mb-2" />
            <CardTitle className="text-base">Importar XML</CardTitle>
            <CardDescription>
              Upload de XML da NF-e ou CT-e
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {selectedMode === 'import' && (
        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Informe a chave de acesso de 44 dígitos da NF-e ou CT-e para importar os dados automaticamente da SEFAZ.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Chave de Acesso (44 dígitos)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="00000000000000000000000000000000000000000000"
                maxLength={44}
                value={importAccessKey}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setImportAccessKey(value);
                  setAccessKeyError('');
                }}
                className="font-mono"
                disabled={lookupLoading}
              />
              <Button 
                onClick={handleLookupDocument}
                disabled={importAccessKey.length !== 44 || lookupLoading}
              >
                {lookupLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Buscar
                  </>
                )}
              </Button>
            </div>
            {accessKeyError && (
              <p className="text-sm text-destructive">{accessKeyError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              A chave será validada automaticamente e consultada na SEFAZ
            </p>
          </div>

          {lookupResult && lookupResult.success && (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-green-900 dark:text-green-100">
                    Documento encontrado!
                  </CardTitle>
                </div>
                <CardDescription className="text-green-700 dark:text-green-300">
                  {lookupResult.documentType === 'nfe' ? 'NF-e' : 'CT-e'} localizado com sucesso na SEFAZ.
                  Os dados foram importados automaticamente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Emitente:</strong>
                    <p className="text-muted-foreground">
                      {lookupResult.parsedData?.emitter?.razaoSocial}
                    </p>
                  </div>
                  <div>
                    <strong>Destinatário:</strong>
                    <p className="text-muted-foreground">
                      {lookupResult.parsedData?.recipient?.nome}
                    </p>
                  </div>
                  <div>
                    <strong>Valor Total:</strong>
                    <p className="text-muted-foreground">
                      {formatCurrency(lookupResult.parsedData?.values?.total || 0)}
                    </p>
                  </div>
                  <div>
                    <strong>CFOP Detectado:</strong>
                    <p className="text-muted-foreground">
                      {lookupResult.parsedData?.cfop}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Badge variant="outline" className="mt-2">
                      Tipo: {lookupResult.parsedData?.suggestedOperationType === 'subcontratacao' ? 'Subcontratação' : 
                             lookupResult.parsedData?.suggestedOperationType === 'redespacho' ? 'Redespacho' : 'Normal'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {selectedMode === 'upload' && (
        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>NF-e:</strong> Gera um CT-e normal com os dados da nota.
              <br />
              <strong>CT-e:</strong> Gera um contra CT-e (subcontratação) com base no CT-e original.
            </AlertDescription>
          </Alert>

          {!uploadResult && (
            <div 
              className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                accept=".xml"
                onChange={handleFileUpload}
                className="hidden"
                ref={fileInputRef}
                disabled={lookupLoading}
              />
              {lookupLoading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p className="font-medium">Processando XML...</p>
                </div>
              ) : (
                <>
                  <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="font-medium">Clique para selecionar ou arraste o arquivo XML</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Formatos aceitos: NF-e (.xml) ou CT-e (.xml) - Máximo 5MB
                  </p>
                </>
              )}
            </div>
          )}

          {uploadResult && (
            <div className="space-y-4">
              {uploadResult.type === 'cte' && (
                <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                  <RefreshCw className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700 dark:text-amber-300">
                    <strong>CT-e Detectado - Modo Subcontratação</strong>
                    <br />
                    O XML importado é de um CT-e. O sistema configurou automaticamente o tipo de operação como SUBCONTRATAÇÃO.
                    Revise os dados e ajuste o valor do frete se necessário.
                  </AlertDescription>
                </Alert>
              )}

              <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <CardTitle className="text-green-900 dark:text-green-100">
                        {uploadResult.type === 'nfe' ? 'NF-e' : 'CT-e'} importado com sucesso!
                      </CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetUpload}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Trocar arquivo
                    </Button>
                  </div>
                  <CardDescription className="text-green-700 dark:text-green-300">
                    {uploadedFile?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {uploadResult.type === 'nfe' ? (
                      <>
                        <div>
                          <strong>Emitente:</strong>
                          <p className="text-muted-foreground">{uploadResult.data.emitter.name}</p>
                        </div>
                        <div>
                          <strong>Destinatário:</strong>
                          <p className="text-muted-foreground">{uploadResult.data.recipient.name}</p>
                        </div>
                        <div>
                          <strong>Valor Total:</strong>
                          <p className="text-muted-foreground">
                            {formatCurrency(uploadResult.data.totals.total)}
                          </p>
                        </div>
                        <div>
                          <strong>Itens:</strong>
                          <p className="text-muted-foreground">
                            {uploadResult.data.items.length} produto(s)
                          </p>
                        </div>
                        <div className="col-span-2">
                          <strong>Chave de Acesso:</strong>
                          <p className="text-muted-foreground font-mono text-xs break-all">
                            {uploadResult.data.accessKey}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <strong>Remetente:</strong>
                          <p className="text-muted-foreground">{uploadResult.data.sender.name}</p>
                        </div>
                        <div>
                          <strong>Destinatário:</strong>
                          <p className="text-muted-foreground">{uploadResult.data.recipient.name}</p>
                        </div>
                        <div>
                          <strong>Valor do Frete:</strong>
                          <p className="text-muted-foreground">
                            {formatCurrency(uploadResult.data.values.freightTotal)}
                          </p>
                        </div>
                        <div>
                          <strong>Número do CT-e:</strong>
                          <p className="text-muted-foreground">{uploadResult.data.cteNumber}</p>
                        </div>
                        <div className="col-span-2">
                          <strong>Chave de Acesso:</strong>
                          <p className="text-muted-foreground font-mono text-xs break-all">
                            {uploadResult.data.accessKey}
                          </p>
                        </div>
                      </>
                    )}
                    <div className="col-span-2">
                      <Badge variant="outline" className="mt-2">
                        Tipo de Operação: {uploadResult.operationType === 'subcontratacao' ? 'Subcontratação' : 'Normal'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
