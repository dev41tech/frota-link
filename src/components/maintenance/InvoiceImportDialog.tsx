import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  Package,
  Wrench,
  Loader2
} from "lucide-react";
import { 
  parseMaintenanceInvoice, 
  ParsedInvoice, 
  ParsedItem,
  formatCNPJ,
  suggestServiceCategory
} from "@/lib/maintenanceInvoiceParser";

interface InvoiceImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: {
    invoice: ParsedInvoice;
    parts: ParsedItem[];
    laborCost: number;
    partsCost: number;
    suggestedCategory: string;
  }) => void;
}

export function InvoiceImportDialog({
  open,
  onOpenChange,
  onImport,
}: InvoiceImportDialogProps) {
  const [parsedData, setParsedData] = useState<ParsedInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".xml")) {
      setError("Por favor, selecione um arquivo XML de NF-e");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const content = await file.text();
      const parsed = parseMaintenanceInvoice(content);

      if (!parsed) {
        setError("Não foi possível processar o arquivo XML. Verifique se é uma NF-e válida.");
        return;
      }

      if (parsed.items.length === 0) {
        setError("Nenhum produto ou serviço encontrado na nota fiscal.");
        return;
      }

      setParsedData(parsed);
    } catch (err) {
      console.error("Erro ao ler arquivo:", err);
      setError("Erro ao ler o arquivo XML.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedData) return;

    const parts = parsedData.items.filter(i => !i.isService);
    const services = parsedData.items.filter(i => i.isService);
    
    onImport({
      invoice: parsedData,
      parts,
      laborCost: parsedData.totalServices,
      partsCost: parsedData.totalProducts,
      suggestedCategory: suggestServiceCategory(parsedData.items),
    });

    // Reset state
    setParsedData(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  const handleClose = () => {
    setParsedData(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Nota Fiscal
          </DialogTitle>
          <DialogDescription>
            Importe um arquivo XML de NF-e para preencher automaticamente os dados da manutenção
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Upload Area */}
          {!parsedData && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml"
                onChange={handleFileChange}
                className="hidden"
                id="invoice-file"
              />
              <label
                htmlFor="invoice-file"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                {loading ? (
                  <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
                ) : (
                  <Upload className="h-12 w-12 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">Clique para selecionar o arquivo XML</p>
                  <p className="text-sm text-muted-foreground">
                    Arquivo XML da NF-e emitida pela oficina
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Parsed Data Display */}
          {parsedData && (
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4">
                {/* Success Alert */}
                <Alert className="border-green-500 bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    Nota fiscal processada com sucesso!
                  </AlertDescription>
                </Alert>

                {/* Invoice Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Número da NF</Label>
                    <p className="font-medium">{parsedData.invoiceNumber}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Data de Emissão</Label>
                    <p className="font-medium">
                      {new Date(parsedData.invoiceDate).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Chave de Acesso</Label>
                    <p className="font-mono text-xs break-all">{parsedData.invoiceKey}</p>
                  </div>
                </div>

                {/* Workshop Info */}
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-medium">Oficina / Fornecedor</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nome</Label>
                      <p>{parsedData.workshop.name}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">CNPJ</Label>
                      <p>{formatCNPJ(parsedData.workshop.cnpj)}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Endereço</Label>
                      <p>
                        {parsedData.workshop.address}, {parsedData.workshop.city} - {parsedData.workshop.state}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className="border rounded-lg">
                  <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="font-medium">Itens da Nota</span>
                    </div>
                    <Badge variant="secondary">{parsedData.items.length} itens</Badge>
                  </div>
                  <div className="divide-y max-h-[200px] overflow-y-auto">
                    {parsedData.items.map((item, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium">{item.description}</p>
                            {item.isService && (
                              <Badge variant="outline" className="shrink-0">
                                <Wrench className="h-3 w-3 mr-1" />
                                Serviço
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} {item.unit} × R$ {item.unitPrice.toFixed(2)}
                          </p>
                        </div>
                        <p className="font-medium ml-4">
                          R$ {item.totalPrice.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Peças</p>
                    <p className="text-lg font-bold text-primary">
                      R$ {parsedData.totalProducts.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Mão de Obra</p>
                    <p className="text-lg font-bold text-primary">
                      R$ {parsedData.totalServices.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-bold text-primary">
                      R$ {parsedData.totalValue.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {parsedData && (
            <Button onClick={handleConfirmImport}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Importar Dados
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
