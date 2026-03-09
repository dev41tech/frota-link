import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { Search, Download, FileText, Paperclip, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { parseDateString } from '@/lib/utils';

interface LinkedDocument {
  type: 'nfe' | 'cte';
  key: string;
  number: string;
  series: string;
  value?: number;
  issueDate?: string;
}

interface CTe {
  id: string;
  cte_number: string;
  cte_key: string;
  emission_date: string;
  recipient_name: string;
  sender_name: string;
  freight_value: number;
  status: string;
  pdf_url: string | null;
  linked_documents: LinkedDocument[] | null;
  referenced_cte_key: string | null;
}

export function FiscalDocumentsHistory() {
  const [ctes, setCtes] = useState<CTe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { currentCompany } = useMultiTenant();

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  useEffect(() => {
    if (currentCompany) {
      fetchCTes();
    }
  }, [currentCompany]);

  const fetchCTes = async () => {
    if (!currentCompany) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cte_documents')
        .select('*')
        .eq('company_id', currentCompany.id)
        .is('deleted_at', null)
        .order('emission_date', { ascending: false });

      if (error) throw error;
      
      // Mapear dados do banco para o tipo CTe
      const mappedData: CTe[] = (data || []).map(doc => ({
        id: doc.id,
        cte_number: doc.cte_number,
        cte_key: doc.cte_key,
        emission_date: doc.emission_date,
        recipient_name: doc.recipient_name,
        sender_name: doc.sender_name,
        freight_value: doc.freight_value,
        status: doc.status,
        pdf_url: doc.pdf_url,
        linked_documents: (doc.linked_documents && Array.isArray(doc.linked_documents)) 
          ? doc.linked_documents as unknown as LinkedDocument[] 
          : null,
        referenced_cte_key: doc.referenced_cte_key
      }));
      
      setCtes(mappedData);
    } catch (error) {
      console.error('Error fetching CT-es:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      authorized: { label: 'Autorizado', variant: 'default' },
      processing: { label: 'Processando', variant: 'secondary' },
      cancelled: { label: 'Cancelado', variant: 'destructive' },
      draft: { label: 'Rascunho', variant: 'outline' }
    };

    const config = statusConfig[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredCTes = ctes.filter(cte =>
    cte.cte_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cte.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cte.sender_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Histórico de Documentos Fiscais
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar documentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Data Emissão</TableHead>
              <TableHead>Remetente</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCTes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum documento encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredCTes.map((cte) => {
                const hasLinkedDocs = cte.linked_documents && cte.linked_documents.length > 0;
                const isExpanded = expandedRows.has(cte.id);
                
                return (
                  <>
                    <TableRow key={cte.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {hasLinkedDocs && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRow(cte.id)}
                              className="h-6 w-6 p-0"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {cte.cte_number || '-'}
                          {hasLinkedDocs && (
                            <Paperclip className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                      {cte.emission_date 
                          ? format(parseDateString(cte.emission_date), "dd/MM/yyyy", { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>{cte.sender_name || '-'}</TableCell>
                      <TableCell>{cte.recipient_name || '-'}</TableCell>
                      <TableCell>
                        {cte.freight_value 
                          ? `R$ ${cte.freight_value.toFixed(2)}` 
                          : '-'
                        }
                      </TableCell>
                      <TableCell>{getStatusBadge(cte.status)}</TableCell>
                      <TableCell>
                        {cte.pdf_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={cte.pdf_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {hasLinkedDocs && isExpanded && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/50">
                          <div className="py-2 px-4">
                            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Documentos Vinculados ({cte.linked_documents?.length})
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {cte.linked_documents?.map((doc, idx) => (
                                <div key={idx} className="text-sm border rounded p-2 bg-background">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <Badge variant="outline" className="mb-1">
                                        {doc.type === 'nfe' ? 'NF-e' : 'CT-e'}
                                      </Badge>
                                      <p className="font-mono text-xs text-muted-foreground">
                                        {doc.number}/{doc.series}
                                      </p>
                                    </div>
                                    {doc.value && (
                                      <span className="text-xs">R$ {doc.value.toFixed(2)}</span>
                                    )}
                                  </div>
                                  <p className="font-mono text-xs mt-1 text-muted-foreground truncate">
                                    {doc.key}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
