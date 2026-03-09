import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from '@/hooks/useMultiTenant';

interface CteSeries {
  id: string;
  series: string;
  next_number: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SeriesStats {
  series: string;
  total_emitted: number;
  last_number: number;
}

export function CTeSeriesManager() {
  const { toast } = useToast();
  const { currentCompany } = useMultiTenant();
  const [series, setSeries] = useState<CteSeries[]>([]);
  const [stats, setStats] = useState<SeriesStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<CteSeries | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    series: '',
    next_number: 1,
    description: '',
    is_active: true,
  });

  const companyId = typeof currentCompany === 'string' ? currentCompany : currentCompany?.id;

  useEffect(() => {
    if (companyId) {
      fetchSeries();
      fetchStats();
    }
  }, [companyId]);

  const fetchSeries = async () => {
    if (!companyId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('cte_series')
      .select('*')
      .eq('company_id', companyId)
      .order('series');

    if (error) {
      console.error('Error fetching series:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as séries",
        variant: "destructive",
      });
    } else {
      setSeries(data || []);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    if (!companyId) return;
    
    const { data, error } = await supabase
      .from('cte_documents')
      .select('series, cte_number')
      .eq('company_id', companyId)
      .in('status', ['authorized', 'pending']);

    if (!error && data) {
      const statsMap = new Map<string, SeriesStats>();
      
      data.forEach(doc => {
        const s = doc.series || '1';
        const num = parseInt(doc.cte_number) || 0;
        
        if (!statsMap.has(s)) {
          statsMap.set(s, { series: s, total_emitted: 0, last_number: 0 });
        }
        
        const stat = statsMap.get(s)!;
        stat.total_emitted++;
        if (num > stat.last_number) {
          stat.last_number = num;
        }
      });
      
      setStats(Array.from(statsMap.values()));
    }
  };

  const openNewDialog = () => {
    setEditingSeries(null);
    setFormData({
      series: '',
      next_number: 1,
      description: '',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (s: CteSeries) => {
    setEditingSeries(s);
    setFormData({
      series: s.series,
      next_number: s.next_number,
      description: s.description || '',
      is_active: s.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!companyId) return;
    
    if (!formData.series.trim()) {
      toast({
        title: "Erro",
        description: "Informe o número da série",
        variant: "destructive",
      });
      return;
    }

    if (formData.next_number < 1) {
      toast({
        title: "Erro",
        description: "O próximo número deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }

    // Validate against last emitted number
    const stat = stats.find(st => st.series === formData.series);
    if (stat && formData.next_number <= stat.last_number) {
      toast({
        title: "Número inválido",
        description: `O próximo número deve ser maior que ${stat.last_number} (último CT-e emitido nesta série)`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    
    if (editingSeries) {
      const { error } = await supabase
        .from('cte_series')
        .update({
          next_number: formData.next_number,
          description: formData.description || null,
          is_active: formData.is_active,
        })
        .eq('id', editingSeries.id);

      if (error) {
        console.error('Error updating series:', error);
        toast({
          title: "Erro",
          description: "Não foi possível atualizar a série",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sucesso",
          description: "Série atualizada com sucesso",
        });
        setDialogOpen(false);
        fetchSeries();
      }
    } else {
      const { error } = await supabase
        .from('cte_series')
        .insert({
          company_id: companyId,
          series: formData.series.trim(),
          next_number: formData.next_number,
          description: formData.description || null,
          is_active: formData.is_active,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Erro",
            description: "Já existe uma série com esse número",
            variant: "destructive",
          });
        } else {
          console.error('Error creating series:', error);
          toast({
            title: "Erro",
            description: "Não foi possível criar a série",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Sucesso",
          description: "Série criada com sucesso",
        });
        setDialogOpen(false);
        fetchSeries();
      }
    }

    setSaving(false);
  };

  const getStatForSeries = (seriesNumber: string) => {
    return stats.find(s => s.series === seriesNumber);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg">Séries de CT-e</CardTitle>
            <CardDescription>
              Configure a numeração das séries para emissão de CT-e
            </CardDescription>
          </div>
          <Button onClick={openNewDialog} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Série
          </Button>
        </CardHeader>
        <CardContent>
          {series.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma série configurada.</p>
              <p className="text-sm mt-1">
                O sistema usará a série padrão das configurações com numeração automática.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Série</TableHead>
                  <TableHead>Próximo Número</TableHead>
                  <TableHead>Último Emitido</TableHead>
                  <TableHead>Total Emitido</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.map((s) => {
                  const stat = getStatForSeries(s.series);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.series}</TableCell>
                      <TableCell>{s.next_number}</TableCell>
                      <TableCell>{stat?.last_number || '-'}</TableCell>
                      <TableCell>{stat?.total_emitted || 0}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {s.description || '-'}
                      </TableCell>
                      <TableCell>
                        {s.is_active ? (
                          <Badge variant="default" className="bg-primary/10 text-primary">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(s)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> Alterar o número inicial pode causar rejeição na SEFAZ 
              se já existir CT-e com esse número. Verifique sempre o último número emitido antes de alterar.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSeries ? 'Editar Série' : 'Nova Série'}
            </DialogTitle>
            <DialogDescription>
              {editingSeries 
                ? 'Altere as configurações da série de CT-e'
                : 'Configure uma nova série para emissão de CT-e'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="series">Número da Série</Label>
              <Input
                id="series"
                value={formData.series}
                onChange={(e) => setFormData({ ...formData, series: e.target.value })}
                placeholder="Ex: 1"
                disabled={!!editingSeries}
                maxLength={3}
              />
              {editingSeries && (
                <p className="text-xs text-muted-foreground">
                  O número da série não pode ser alterado após criação
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="next_number">Próximo Número a Emitir</Label>
              <Input
                id="next_number"
                type="number"
                min={1}
                value={formData.next_number}
                onChange={(e) => setFormData({ ...formData, next_number: parseInt(e.target.value) || 1 })}
              />
              {(() => {
                const stat = stats.find(st => st.series === formData.series);
                if (stat && stat.last_number > 0) {
                  return (
                    <p className="text-xs text-destructive">
                      ⚠️ Último CT-e emitido nesta série: {stat.last_number}
                    </p>
                  );
                }
                return null;
              })()}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Série principal"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Série Ativa</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSeries ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
