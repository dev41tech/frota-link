import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle, XCircle, Download, RefreshCw, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FiscalDocumentLookup {
  id: string;
  access_key: string;
  document_type: 'nfe' | 'cte';
  success: boolean;
  error_message: string | null;
  raw_xml: string | null;
  parsed_data: any;
  created_at: string;
}

interface DocumentLookupHistoryProps {
  onReuseData?: (data: any) => void;
}

export function DocumentLookupHistory({ onReuseData }: DocumentLookupHistoryProps) {
  const [lookups, setLookups] = useState<FiscalDocumentLookup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchLookups();
  }, []);

  const fetchLookups = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fiscal_document_lookups')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLookups((data as FiscalDocumentLookup[]) || []);
    } catch (error: any) {
      console.error('Error fetching lookups:', error);
      toast.error('Erro ao carregar histórico de consultas');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadXml = (lookup: FiscalDocumentLookup) => {
    if (!lookup.raw_xml) {
      toast.error('XML não disponível');
      return;
    }

    const blob = new Blob([lookup.raw_xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lookup.document_type}-${lookup.access_key}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('XML baixado com sucesso');
  };

  const handleReuseData = (lookup: FiscalDocumentLookup) => {
    if (!lookup.success || !lookup.parsed_data) {
      toast.error('Não é possível reutilizar dados de uma consulta com erro');
      return;
    }

    onReuseData?.(lookup.parsed_data);
    toast.success('Dados carregados no formulário');
  };

  const filteredLookups = lookups.filter(lookup => 
    lookup.access_key.includes(filter) ||
    lookup.document_type.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Histórico de Consultas
            </CardTitle>
            <CardDescription>
              Consultas realizadas na SEFAZ via chave de acesso
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchLookups}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Filtrar por chave ou tipo</Label>
          <Input
            placeholder="Digite para filtrar..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-md"
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Chave de Acesso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Carregando histórico...
                  </TableCell>
                </TableRow>
              ) : filteredLookups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {filter ? 'Nenhuma consulta encontrada com este filtro' : 'Nenhuma consulta realizada ainda'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLookups.map((lookup) => (
                  <TableRow key={lookup.id}>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(lookup.created_at), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {lookup.document_type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {lookup.access_key.substring(0, 8)}...{lookup.access_key.substring(36)}
                    </TableCell>
                    <TableCell>
                      {lookup.success ? (
                        <Badge variant="default" className="flex items-center gap-1 w-fit">
                          <CheckCircle className="h-3 w-3" />
                          Sucesso
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <XCircle className="h-3 w-3" />
                          Erro
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {lookup.success && onReuseData && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReuseData(lookup)}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Reutilizar
                          </Button>
                        )}
                        {lookup.raw_xml && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadXml(lookup)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && filteredLookups.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Mostrando {filteredLookups.length} de {lookups.length} consultas
          </p>
        )}
      </CardContent>
    </Card>
  );
}
