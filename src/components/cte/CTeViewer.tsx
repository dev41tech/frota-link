import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Copy, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CTeViewerProps {
  cteData: {
    id: string;
    cte_number?: string | null;
    cte_key?: string | null;
    status: string;
    emission_date?: string | null;
    xml_content?: string | null;
    pdf_url?: string | null;
  };
  onClose?: () => void;
}

export function CTeViewer({ cteData, onClose }: CTeViewerProps) {
  const { toast } = useToast();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'authorized':
      case 'autorizado':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Autorizado
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Processando
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Rejeitado
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleCopyKey = () => {
    if (cteData.cte_key) {
      navigator.clipboard.writeText(cteData.cte_key);
      toast({
        title: 'Copiado',
        description: 'Chave de acesso copiada para a área de transferência',
      });
    }
  };

  const handleDownloadXML = () => {
    if (cteData.xml_content) {
      const blob = new Blob([cteData.xml_content], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cte-${cteData.cte_number || cteData.id}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadPDF = async () => {
    if (!cteData.pdf_url) return;
    
    try {
      const response = await fetch(cteData.pdf_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cte-${cteData.cte_number || cteData.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Sucesso',
        description: 'PDF baixado com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao baixar PDF',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle>CT-e Emitido</CardTitle>
          </div>
          {getStatusBadge(cteData.status)}
        </div>
        <CardDescription>
          Conhecimento de Transporte Eletrônico emitido com sucesso
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {cteData.cte_number && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Número do CT-e</p>
            <p className="text-lg font-semibold">{cteData.cte_number}</p>
          </div>
        )}

        {cteData.cte_key && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Chave de Acesso</p>
            <div className="flex items-center gap-2">
              <p className="text-sm font-mono bg-muted p-2 rounded flex-1 break-all">
                {cteData.cte_key}
              </p>
              <Button variant="outline" size="sm" onClick={handleCopyKey}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {cteData.emission_date && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Data de Emissão</p>
            <p className="text-sm">
              {new Date(cteData.emission_date).toLocaleString('pt-BR')}
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          {cteData.xml_content && (
            <Button variant="outline" onClick={handleDownloadXML} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Baixar XML
            </Button>
          )}
          {cteData.pdf_url && (
            <Button variant="outline" onClick={handleDownloadPDF} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
          )}
        </div>

        {onClose && (
          <Button variant="secondary" onClick={onClose} className="w-full">
            Fechar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
