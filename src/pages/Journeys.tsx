import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, MapPin, Truck, User, Edit, Trash2, FileText, Eye, CheckCircle, Info, AlertTriangle, Loader2, X, Upload, Link2, AlertCircle, Search, Copy, MoreVertical, Filter, Route, DollarSign, Activity, FileImage } from 'lucide-react';
import { JourneyLegsEditor, type LegData, buildRouteString } from '@/components/journeys/JourneyLegsEditor';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { parseCTeXml } from '@/lib/cteXmlParser';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { LocationDisplay } from '@/components/ui/location-display';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JourneyExpenses } from '@/components/journeys/JourneyExpenses';
import { JourneyFinancialSummary } from '@/components/journeys/JourneyFinancialSummary';
import { JourneyFuelExpenses } from '@/components/journeys/JourneyFuelExpenses';
import { JourneyRevenues } from '@/components/journeys/JourneyRevenues';
import { ClosureApprovalPanel } from '@/components/journeys/ClosureApprovalPanel';
import { JourneyChecklistView } from '@/components/journeys/JourneyChecklistView';
import { JourneyReceipts, useJourneyReceiptCount } from '@/components/journeys/JourneyReceipts';
import { toUuidOrNull } from '@/lib/databaseUtils';
import { useClosureRequests } from '@/hooks/useClosureRequests';
import { useJourneyApprovalRequests } from '@/hooks/useJourneyApprovalRequests';
import { PartySelector } from '@/components/parties/PartySelector';
import { toast as sonnerToast } from 'sonner';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { JourneyVehicleSelector } from '@/components/journeys/JourneyVehicleSelector';
import { useVehicleCouplings, type CreateCouplingInput } from '@/hooks/useVehicleCouplings';

// Interface para CT-e importado
interface ImportedCTe {
  accessKey: string;
  cteNumber: string;
  origin: string;
  destination: string;
  freightValue: number;
  emitterName: string;
  recipientName: string;
}

interface Journey {
  id: string;
  journey_number: string;
  origin: string;
  destination: string;
  distance: number | null;
  freight_value: number | null;
  freight_status: string | null;
  freight_received_date: string | null;
  freight_due_date: string | null;
  actualRevenue?: number;
  commission_percentage: number | null;
  commission_value: number | null;
  advance_value: number | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  start_km: number | null;
  end_km: number | null;
  start_location_lat?: number | null;
  start_location_lng?: number | null;
  start_location_address?: string | null;
  end_location_lat?: number | null;
  end_location_lng?: number | null;
  end_location_address?: string | null;
  notes: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  customer_id: string | null;
  coupling_id: string | null;
  vehicles: { plate: string; model: string } | null;
  drivers: { name: string } | null;
  parties?: { id: string; name: string } | null;
  cte_documents?: Array<{ id: string; cte_number: string | null; status: string }>;
  vehicle_couplings?: {
    id: string;
    coupling_type: string;
    vehicle_coupling_items: Array<{
      trailer_id: string;
      position: number;
      vehicles: { plate: string } | null;
    }>;
  } | null;
}

interface Vehicle {
  id: string;
  plate: string;
  model: string;
}

interface Driver {
  id: string;
  name: string;
}

export default function Journeys() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();
  const location = useLocation();
  const { count: closureRequestsCount } = useClosureRequests();
  const { count: approvalRequestsCount, refresh: refreshApprovals } = useJourneyApprovalRequests();
  
  
  // Vehicle couplings hook
  const {
    activeCouplings,
    trucks: allTrucks,
    trailers: allTrailers,
    availableTrucks,
    availableTrailers,
    savedCouplings,
    createCoupling,
    saveCouplingTemplate,
    getLatestCouplingForTruck,
    refetch: refetchCouplings
  } = useVehicleCouplings();

  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJourney, setEditingJourney] = useState<Journey | null>(null);
  const [viewingJourney, setViewingJourney] = useState<Journey | null>(null);
  const receiptCount = useJourneyReceiptCount(viewingJourney?.id);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Estado para dialog de conclusão de jornada
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completingJourney, setCompletingJourney] = useState<Journey | null>(null);
  const [endKm, setEndKm] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [suggestedEndKm, setSuggestedEndKm] = useState<number | null>(null);
  const [nextJourneyInfo, setNextJourneyInfo] = useState<{ journey_number: string; start_km: number } | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  // Calcular discrepância de KM
  const kmDiscrepancy = suggestedEndKm && endKm ? suggestedEndKm - Number(endKm) : 0;

  // Coupling state for form
  const [selectedCouplingId, setSelectedCouplingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    journey_number: '',
    origin: '',
    destination: '',
    distance: '',
    freight_value: '',
    freight_status: 'pending',
    freight_received_date: '',
    freight_due_date: '',
    commission_percentage: '',
    advance_value: '',
    vehicle_id: '',
    driver_id: '',
    customer_id: '',
    status: 'planned',
    start_date: '',
    start_km: '',
    end_date: '',
    end_km: '',
    notes: ''
  });

  // Legs state
  const [legs, setLegs] = useState<LegData[]>([{ leg_number: 1, origin: '', destination: '', freight_status: 'pending' }]);
  const [detailsLegs, setDetailsLegs] = useState<LegData[]>([]);

  // Estados para importação de CT-e via XML
  const [importMode, setImportMode] = useState<'manual' | 'import'>('manual');
  const [importLoading, setImportLoading] = useState(false);
  const [importedCTes, setImportedCTes] = useState<ImportedCTe[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handler for legs changes - sync summary fields
  const handleLegsChange = (newLegs: LegData[]) => {
    setLegs(newLegs);
    if (newLegs.length > 0) {
      const totalFreight = newLegs.reduce((sum, leg) => sum + (parseFloat(leg.freight_value || '0') || 0), 0);
      const totalDistance = newLegs.reduce((sum, leg) => sum + (parseFloat(leg.distance || '0') || 0), 0);
      setFormData(prev => ({
        ...prev,
        origin: newLegs[0].origin,
        destination: newLegs[newLegs.length - 1].destination,
        freight_value: totalFreight > 0 ? String(totalFreight) : prev.freight_value,
        distance: totalDistance > 0 ? String(totalDistance) : prev.distance,
        customer_id: newLegs.length === 1 ? (newLegs[0].customer_id || prev.customer_id) : prev.customer_id,
        freight_status: newLegs.length === 1 ? (newLegs[0].freight_status || prev.freight_status) : prev.freight_status,
        freight_due_date: newLegs.length === 1 ? (newLegs[0].freight_due_date || prev.freight_due_date) : prev.freight_due_date,
        freight_received_date: newLegs.length === 1 ? (newLegs[0].freight_received_date || prev.freight_received_date) : prev.freight_received_date,
      }));
    }
  };

  // Cálculo reativo do valor da comissão
  const calculatedCommissionValue = React.useMemo(() => {
    const freight = parseFloat(formData.freight_value) || 0;
    const percentage = parseFloat(formData.commission_percentage) || 0;
    return (freight * percentage) / 100;
  }, [formData.freight_value, formData.commission_percentage]);

  // Load legs when viewing journey details
  useEffect(() => {
    if (viewingJourney?.id && detailsDialogOpen) {
      supabase
        .from('journey_legs')
        .select('*')
        .eq('journey_id', viewingJourney.id)
        .order('leg_number')
        .then(({ data }) => {
          if (data && data.length > 0) {
            setDetailsLegs(data.map(l => ({
              id: l.id,
              leg_number: l.leg_number,
              origin: l.origin,
              destination: l.destination,
              customer_id: l.customer_id || '',
              freight_value: l.freight_value != null ? String(l.freight_value) : '',
              freight_status: l.freight_status || 'pending',
              freight_due_date: l.freight_due_date ? l.freight_due_date.split('T')[0] : '',
              freight_received_date: l.freight_received_date ? l.freight_received_date.split('T')[0] : '',
              distance: l.distance != null ? String(l.distance) : '',
              status: l.status || 'in_progress',
            })));
          } else {
            setDetailsLegs([]);
          }
        });
    }
  }, [viewingJourney?.id, detailsDialogOpen]);

  useEffect(() => {
    if (user && currentCompany?.id) {
      fetchJourneys();
      fetchVehicles();
      fetchDrivers();
    }
  }, [user, currentCompany?.id]);

  // Auto-open journey details from navigation state
  useEffect(() => {
    const state = location.state as { openJourneyId?: string } | null;
    if (state?.openJourneyId && journeys.length > 0 && !loading) {
      const journey = journeys.find(j => j.id === state.openJourneyId);
      if (journey) {
        setViewingJourney(journey);
        setDetailsDialogOpen(true);
        // Clear state to avoid re-opening
        window.history.replaceState({}, document.title);
      }
    }
  }, [journeys, loading, location.state]);

  const fetchJourneys = async () => {
    try {
      const { data, error } = await supabase
        .from('journeys')
        .select(`
          *,
          vehicles(plate, model),
          drivers(name),
          parties:customer_id(id, name),
          cte_documents(id, cte_number, status),
          vehicle_couplings(
            id,
            coupling_type,
            vehicle_coupling_items(
              trailer_id,
              position,
              vehicles(plate)
            )
          )
        `)
        .eq('company_id', currentCompany?.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch all revenues in a single batch query (optimized from N+1)
      const { data: allRevenues } = await supabase
        .from('revenue')
        .select('journey_id, amount')
        .eq('company_id', currentCompany?.id)
        .not('journey_id', 'is', null);

      // Build a revenue map grouped by journey_id
      const revenueMap = new Map<string, number>();
      (allRevenues || []).forEach(r => {
        if (r.journey_id) {
          revenueMap.set(r.journey_id, (revenueMap.get(r.journey_id) || 0) + r.amount);
        }
      });

      const journeysWithRevenues = (data || []).map(journey => ({
        ...journey,
        actualRevenue: revenueMap.get(journey.id) || 0
      }));

      setJourneys(journeysWithRevenues);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, plate, model')
        .eq('company_id', currentCompany?.id)
        .eq('status', 'active')
        .not('id', 'is', null);

      if (error) throw error;
      setVehicles((data || []).filter(v => v && v.id));
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, name')
        .eq('company_id', currentCompany?.id)
        .eq('status', 'active')
        .not('id', 'is', null);

      if (error) throw error;
      setDrivers((data || []).filter(d => d && d.id));
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({
      journey_number: '',
      origin: '',
      destination: '',
      distance: '',
      freight_value: '',
      freight_status: 'pending',
      freight_received_date: '',
      freight_due_date: '',
      commission_percentage: '',
      advance_value: '',
      vehicle_id: '',
      driver_id: '',
      customer_id: '',
      status: 'planned',
      start_date: '',
      start_km: '',
      end_date: '',
      end_km: '',
      notes: ''
    });
    setEditingJourney(null);
    setSelectedCouplingId(null);
    setLegs([{ leg_number: 1, origin: '', destination: '', freight_status: 'pending' }]);
    // Reset import states
    setImportMode('manual');
    setImportedCTes([]);
  };

  // Handler for new coupling creation from vehicle selector
  const handleNewCouplingCreate = async (
    input: CreateCouplingInput,
    save: boolean,
    name?: string
  ): Promise<boolean> => {
    const success = await createCoupling(input);
    if (success) {
      // If user wants to save as template
      if (save && name) {
        await saveCouplingTemplate(name, input.truck_id, input.coupling_type, input.trailer_ids);
      }
      // Get the coupling ID
      const couplingId = await getLatestCouplingForTruck(input.truck_id);
      if (couplingId) {
        setSelectedCouplingId(couplingId);
      }
      await refetchCouplings();
    }
    return success;
  };

  // Função auxiliar para ler arquivo como texto
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsText(file);
    });
  };

  // Função para processar arquivos XML
  const processXmlFiles = async (files: File[]) => {
    setImportLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const file of files) {
        // Verificar se é XML
        if (!file.name.toLowerCase().endsWith('.xml')) {
          sonnerToast.error(`${file.name}: Apenas arquivos XML são aceitos`);
          errorCount++;
          continue;
        }

        try {
          // Ler conteúdo do arquivo
          const content = await readFileAsText(file);

          // Parsear XML
          const parsed = parseCTeXml(content);
          if (!parsed) {
            sonnerToast.error(`${file.name}: Erro ao parsear XML do CT-e`);
            errorCount++;
            continue;
          }

          // Verificar duplicata
          if (importedCTes.some(cte => cte.accessKey === parsed.accessKey)) {
            sonnerToast.warning(`CT-e ${parsed.cteNumber || 'sem número'} já foi importado`);
            continue;
          }

          // Criar objeto CT-e importado
          const newCTe: ImportedCTe = {
            accessKey: parsed.accessKey,
            cteNumber: parsed.cteNumber,
            origin: `${parsed.origin.city} - ${parsed.origin.uf}`.trim() || 'Não informado',
            destination: `${parsed.destination.city} - ${parsed.destination.uf}`.trim() || 'Não informado',
            freightValue: parsed.values.freightTotal || parsed.values.freightReceived || 0,
            emitterName: parsed.emitter.name,
            recipientName: parsed.recipient.name,
          };

          // Adicionar à lista
          setImportedCTes(prev => {
            const updatedCTes = [...prev, newCTe];

            // Se é o primeiro CT-e, preencher origem e destino
            if (prev.length === 0) {
              setFormData(fd => ({
                ...fd,
                origin: newCTe.origin,
                destination: newCTe.destination,
              }));
            }

            // Atualizar valor total do frete (soma)
            const newTotal = updatedCTes.reduce((sum, cte) => sum + cte.freightValue, 0);
            setFormData(fd => ({
              ...fd,
              freight_value: String(newTotal),
            }));

            return updatedCTes;
          });

          successCount++;
        } catch (fileError: any) {
          sonnerToast.error(`${file.name}: ${fileError.message}`);
          errorCount++;
        }
      }

      if (successCount > 0) {
        sonnerToast.success(`${successCount} CT-e(s) importado(s) com sucesso!`);
      }
    } finally {
      setImportLoading(false);
      // Limpar input para permitir reimportar mesmo arquivo
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handler para seleção de arquivos
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await processXmlFiles(Array.from(files));
  };

  // Handlers para drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    await processXmlFiles(Array.from(files));
  };

  // Função para remover CT-e da lista
  const handleRemoveCTe = (accessKey: string) => {
    const updatedList = importedCTes.filter(cte => cte.accessKey !== accessKey);
    setImportedCTes(updatedList);

    // Recalcular valor total do frete
    const newTotal = updatedList.reduce((sum, cte) => sum + cte.freightValue, 0);
    setFormData(prev => ({
      ...prev,
      freight_value: newTotal > 0 ? String(newTotal) : '',
    }));

    // Se removeu todos, limpar origem e destino
    if (updatedList.length === 0 && importMode === 'import') {
      setFormData(prev => ({
        ...prev,
        origin: '',
        destination: '',
      }));
    } else if (updatedList.length > 0) {
      // Se ainda tem CT-es, usar origem/destino do primeiro
      setFormData(prev => ({
        ...prev,
        origin: updatedList[0].origin,
        destination: updatedList[0].destination,
      }));
    }
  };

  // Função para mudar modo de importação
  const handleModeChange = (mode: 'manual' | 'import') => {
    setImportMode(mode);
    // Não limpar CT-es já importados ao trocar de modo
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação: se status "completed", exigir end_date e end_km
    if (formData.status === 'completed') {
      if (!formData.end_date) {
        toast({ title: 'Erro', description: 'Data de Encerramento é obrigatória para jornadas concluídas', variant: 'destructive' });
        return;
      }
      if (!formData.end_km) {
        toast({ title: 'Erro', description: 'KM Final é obrigatório para jornadas concluídas', variant: 'destructive' });
        return;
      }
    }

    try {
      const commission_value =
        (parseFloat(formData.freight_value || '0') *
          parseFloat(formData.commission_percentage || '0')) /
        100;

      const journeyData = {
        user_id: user?.id ?? null,
        company_id: currentCompany?.id,
        journey_number: formData.journey_number,
        origin: formData.origin,
        destination: formData.destination,
        distance: formData.distance ? parseFloat(formData.distance) : null,
        freight_value: formData.freight_value ? parseFloat(formData.freight_value) : null,
        freight_status: formData.freight_status || 'pending',
        freight_received_date: formData.freight_received_date || null,
        freight_due_date: formData.freight_due_date || null,
        commission_percentage: formData.commission_percentage ? parseFloat(formData.commission_percentage) : 0,
        commission_value,
        advance_value: formData.advance_value ? parseFloat(formData.advance_value) : 0,
        vehicle_id: toUuidOrNull(formData.vehicle_id),
        driver_id: toUuidOrNull(formData.driver_id),
        customer_id: toUuidOrNull(formData.customer_id),
        coupling_id: selectedCouplingId || null,
        status: formData.status,
        start_date: formData.start_date || null,
        start_km: formData.start_km ? parseInt(formData.start_km) : null,
        end_date: formData.end_date || null,
        end_km: formData.end_km ? parseInt(formData.end_km) : null,
        notes: formData.notes || null
      };

      let journeyId = editingJourney?.id;

      if (editingJourney) {
        // UPDATE Jornada
        const { error } = await supabase
          .from('journeys')
          .update(journeyData)
          .eq('id', editingJourney.id);
        if (error) throw error;

        // Buscar receita automática de frete existente (descrição contém "Frete")
        const { data: existingFreightRevenue } = await supabase
          .from('revenue')
          .select('id')
          .eq('journey_id', editingJourney.id)
          .ilike('description', '%Frete%')
          .limit(1)
          .maybeSingle();

        const freightValue = journeyData.freight_value || 0;
        const revenueStatus = formData.freight_status === 'received' ? 'received' : 'pending';
        const revenueDate = formData.freight_status === 'received' 
          ? formData.freight_received_date 
          : formData.freight_due_date;

        if (freightValue > 0) {
          if (existingFreightRevenue) {
            // UPDATE receita existente
            await supabase
              .from('revenue')
              .update({
                amount: freightValue,
                description: `Frete ${journeyData.journey_number || ''}`,
                status: revenueStatus,
                date: revenueDate || new Date().toISOString()
              })
              .eq('id', existingFreightRevenue.id);
          } else {
            // INSERT nova receita de frete
            await supabase.from('revenue').insert([{
              user_id: user?.id ?? null,
              company_id: currentCompany?.id,
              journey_id: editingJourney.id,
              description: `Frete ${journeyData.journey_number || ''}`,
              amount: freightValue,
              status: revenueStatus,
              date: revenueDate || new Date().toISOString()
            }]);
          }
        } else if (existingFreightRevenue) {
          // DELETE receita de frete se valor zerou
          await supabase.from('revenue').delete().eq('id', existingFreightRevenue.id);
        }

        toast({ title: 'Sucesso', description: 'Jornada atualizada com sucesso!' });
      } else {
        // INSERT Jornada e pegar retorno
        const { data: j, error } = await supabase
          .from('journeys')
          .insert([journeyData])
          .select('id, journey_number, freight_value, user_id')
          .single();
        if (error) throw error;

        journeyId = j.id;

        const revenueStatus = formData.freight_status === 'received' ? 'received' : 'pending';
        const revenueDate = formData.freight_status === 'received' 
          ? formData.freight_received_date 
          : formData.freight_due_date;

        // INSERT Receita vinculada APENAS se freight_value > 0
        if (j.freight_value && j.freight_value > 0) {
          const { error: recErr } = await supabase.from('revenue').insert([
            {
              user_id: j.user_id ?? user?.id ?? null,
              company_id: currentCompany?.id,
              journey_id: j.id,
              description: `Frete ${j.journey_number || ''}`,
              amount: j.freight_value,
              status: revenueStatus,
              date: revenueDate || new Date().toISOString()
            }
          ]);

          if (recErr) {
            toast({
              title: 'Erro ao criar a receita',
              description: recErr.message,
              variant: 'destructive'
            });
          }
        }

        // === SALVAR CT-es IMPORTADOS ===
        if (importedCTes.length > 0) {
          for (const cte of importedCTes) {
            await supabase.from('cte_documents').insert({
              company_id: currentCompany?.id,
              user_id: user?.id,
              journey_id: j.id,
              cte_key: cte.accessKey,
              cte_number: cte.cteNumber,
              sender_name: cte.emitterName,
              sender_document: '',
              sender_address: cte.origin,
              recipient_name: cte.recipientName,
              recipient_document: '',
              recipient_address: cte.destination,
              freight_value: cte.freightValue,
              status: 'imported',
              environment: 'production',
              series: '1'
            });
          }
        }

        toast({
          title: 'Sucesso',
          description: importedCTes.length > 0
            ? `Jornada cadastrada com ${importedCTes.length} CT-e(s) importado(s)!`
            : j.freight_value && j.freight_value > 0 
              ? 'Jornada cadastrada e receita criada com sucesso!'
              : 'Jornada cadastrada com sucesso!'
        });
      }

      // === SALVAR TRECHOS (LEGS) ===
      if (journeyId && legs.length > 0) {
        // Delete existing legs and re-insert
        const { error: deleteLegsError } = await supabase.from('journey_legs').delete().eq('journey_id', journeyId);
        if (deleteLegsError) throw deleteLegsError;
        
        // Delete old per-leg revenues (keep only if legs > 1)
        if (legs.length > 1) {
          // Remove the single freight revenue (will be replaced by per-leg revenues)
          await supabase.from('revenue')
            .delete()
            .eq('journey_id', journeyId)
            .ilike('description', '%Frete%');
        }
        
        for (const leg of legs) {
          const { error: legError } = await supabase.from('journey_legs').insert({
            journey_id: journeyId,
            leg_number: leg.leg_number,
            origin: leg.origin,
            destination: leg.destination,
            customer_id: leg.customer_id ? toUuidOrNull(leg.customer_id) : null,
            freight_value: leg.freight_value ? parseFloat(leg.freight_value) : null,
            freight_status: leg.freight_status || 'pending',
            freight_due_date: leg.freight_due_date || null,
            freight_received_date: leg.freight_received_date || null,
            distance: leg.distance ? parseFloat(leg.distance) : null,
            company_id: currentCompany?.id,
            status: leg.status || (leg.leg_number === 1 ? 'in_progress' : 'pending'),
          });
          if (legError) throw legError;

          // Create per-leg revenue if legs > 1 and freight > 0
          if (legs.length > 1 && leg.freight_value && parseFloat(leg.freight_value) > 0) {
            const legRevenueStatus = leg.freight_status === 'received' ? 'received' : 'pending';
            const legRevenueDate = leg.freight_status === 'received'
              ? leg.freight_received_date
              : leg.freight_due_date;

            await supabase.from('revenue').insert({
              user_id: user?.id ?? null,
              company_id: currentCompany?.id,
              journey_id: journeyId,
              description: `Frete Trecho ${leg.leg_number} - ${leg.origin} → ${leg.destination}`,
              amount: parseFloat(leg.freight_value),
              status: legRevenueStatus,
              date: legRevenueDate || new Date().toISOString(),
            });
          }
        }
      }

      if (journeyId && commission_value > 0 && formData.driver_id) {
        const expenseDate = formData.start_date || new Date().toISOString().split('T')[0];
        const dueDate = formData.freight_due_date || formData.freight_received_date || expenseDate;
        
        // Buscar categoria "Comissão" para usar o ID correto
        const { data: commissionCategory } = await supabase
          .from('expense_categories')
          .select('id')
          .eq('company_id', currentCompany?.id)
          .ilike('name', '%comiss%')
          .limit(1)
          .maybeSingle();

        // Buscar nome do motorista para descrição
        const driver = drivers.find(d => d.id === formData.driver_id);
        const driverName = driver?.name || 'Motorista';

        // ========== AÇÃO 1: CRIAR/ATUALIZAR DESPESA DIRETA ==========
        const { data: existingExpense } = await supabase
          .from('expenses')
          .select('id')
          .eq('journey_id', journeyId)
          .ilike('category', '%comiss%')
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle();

        const expenseData = {
          journey_id: journeyId,
          vehicle_id: formData.vehicle_id || null,
          company_id: currentCompany?.id,
          user_id: user?.id ?? null,
          category: 'Comissão',
          category_id: commissionCategory?.id || null,
          is_direct: true,
          description: `Comissão ${driverName} - Jornada #${formData.journey_number}`,
          amount: commission_value,
          date: expenseDate,
          payment_method: 'bank_transfer',
          status: 'pending'
        };

        if (existingExpense) {
          await supabase
            .from('expenses')
            .update(expenseData)
            .eq('id', existingExpense.id);
        } else {
          await supabase
            .from('expenses')
            .insert([expenseData]);
        }

        // ========== AÇÃO 2: CRIAR/ATUALIZAR CONTA A PAGAR ==========
        const { data: existingPayable } = await supabase
          .from('accounts_payable')
          .select('id')
          .eq('journey_id', journeyId)
          .ilike('category', '%comiss%')
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle();

        const payableData = {
          journey_id: journeyId,
          driver_id: formData.driver_id,
          company_id: currentCompany?.id,
          user_id: user?.id ?? null,
          category: 'Comissão',
          category_id: commissionCategory?.id || null,
          description: `Comissão ${driverName} - Jornada #${formData.journey_number}`,
          amount: commission_value,
          due_date: dueDate,
          status: 'pending',
          is_direct: true,
          supplier: driverName
        };

        if (existingPayable) {
          await supabase
            .from('accounts_payable')
            .update(payableData)
            .eq('id', existingPayable.id);
        } else {
          await supabase
            .from('accounts_payable')
            .insert([payableData]);
        }
      } else if (journeyId && commission_value === 0) {
        // Soft delete de AMBOS os registros se comissão zerou
        await supabase
          .from('expenses')
          .update({ deleted_at: new Date().toISOString() })
          .eq('journey_id', journeyId)
          .ilike('category', '%comiss%');

        await supabase
          .from('accounts_payable')
          .update({ deleted_at: new Date().toISOString() })
          .eq('journey_id', journeyId)
          .ilike('category', '%comiss%');
      }

      setDialogOpen(false);
      resetForm();
      fetchJourneys();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleEdit = async (journey: Journey) => {
    setEditingJourney(journey);
    setFormData({
      journey_number: journey.journey_number || '',
      origin: journey.origin || '',
      destination: journey.destination || '',
      distance: journey.distance != null ? String(journey.distance) : '',
      freight_value: journey.freight_value != null ? String(journey.freight_value) : '',
      freight_status: journey.freight_status || 'pending',
      freight_received_date: journey.freight_received_date ? journey.freight_received_date.split('T')[0] : '',
      freight_due_date: journey.freight_due_date ? journey.freight_due_date.split('T')[0] : '',
      commission_percentage:
        journey.commission_percentage != null ? String(journey.commission_percentage) : '',
      advance_value: journey.advance_value != null ? String(journey.advance_value) : '',
      vehicle_id: journey.vehicle_id || '',
      driver_id: journey.driver_id || '',
      customer_id: journey.customer_id || '',
      status: journey.status || 'planned',
      start_date: journey.start_date ? journey.start_date.split('T')[0] : '',
      start_km: journey.start_km != null ? String(journey.start_km) : '',
      end_date: journey.end_date ? journey.end_date.split('T')[0] : '',
      end_km: journey.end_km != null ? String(journey.end_km) : '',
      notes: journey.notes || ''
    });

    // Load legs
    const { data: legsData } = await supabase
      .from('journey_legs')
      .select('*')
      .eq('journey_id', journey.id)
      .order('leg_number');
    
    if (legsData && legsData.length > 0) {
      setLegs(legsData.map(l => ({
        id: l.id,
        leg_number: l.leg_number,
        origin: l.origin,
        destination: l.destination,
        customer_id: l.customer_id || '',
        freight_value: l.freight_value != null ? String(l.freight_value) : '',
        freight_status: l.freight_status || 'pending',
        freight_due_date: l.freight_due_date ? l.freight_due_date.split('T')[0] : '',
        freight_received_date: l.freight_received_date ? l.freight_received_date.split('T')[0] : '',
        distance: l.distance != null ? String(l.distance) : '',
        status: l.status || 'in_progress',
      })));
    } else {
      setLegs([{
        leg_number: 1,
        origin: journey.origin || '',
        destination: journey.destination || '',
        customer_id: journey.customer_id || '',
        freight_value: journey.freight_value != null ? String(journey.freight_value) : '',
        freight_status: journey.freight_status || 'pending',
        freight_due_date: journey.freight_due_date ? journey.freight_due_date.split('T')[0] : '',
        freight_received_date: journey.freight_received_date ? journey.freight_received_date.split('T')[0] : '',
        distance: journey.distance != null ? String(journey.distance) : '',
      }]);
    }

    setDialogOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);

    try {
      // PRIMEIRO: Excluir TODOS os registros relacionados (ordem importante!)
      
      // Excluir contas a pagar vinculadas
      await supabase
        .from('accounts_payable')
        .delete()
        .eq('journey_id', deletingId);
      
      // Excluir despesas vinculadas
      await supabase
        .from('expenses')
        .delete()
        .eq('journey_id', deletingId);
      
      // Excluir abastecimentos vinculados
      await supabase
        .from('fuel_expenses')
        .delete()
        .eq('journey_id', deletingId);
      
      // Excluir receitas vinculadas
      await supabase
        .from('revenue')
        .delete()
        .eq('journey_id', deletingId);
      
      // Desvincular CT-es (manter o documento, apenas remover referência)
      await supabase
        .from('cte_documents')
        .update({ journey_id: null })
        .eq('journey_id', deletingId);
      
      // Excluir checklists vinculados
      await supabase
        .from('journey_checklists')
        .delete()
        .eq('journey_id', deletingId);
      
      // Excluir mensagens do motorista vinculadas
      await supabase
        .from('driver_messages')
        .delete()
        .eq('journey_id', deletingId);

      // Desvincular solicitações de frete
      await supabase
        .from('freight_requests')
        .update({
          journey_id: null,
          status: 'approved',
          vehicle_id: null,
          driver_id: null,
        })
        .eq('journey_id', deletingId);

      // DEPOIS: Excluir a jornada
      const { error } = await supabase
        .from('journeys')
        .delete()
        .eq('id', deletingId);
      
      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Jornada e registros vinculados excluídos permanentemente!' });
      setDeleteDialogOpen(false);
      setDeletingId(null);
      fetchJourneys();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'pending_approval':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'planned':
        return 'Planejada';
      case 'in_progress':
        return 'Em Andamento';
      case 'completed':
        return 'Concluída';
      case 'cancelled':
        return 'Cancelada';
      case 'pending_approval':
        return 'Aguardando Aprovação';
      default:
        return status;
    }
  };

  const formatCurrency = (value: number | null) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);

  // ========== FILTER & PAGINATION STATE ==========
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  const filteredJourneys = useMemo(() => {
    let result = journeys;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(j =>
        j.journey_number?.toLowerCase().includes(term) ||
        j.origin?.toLowerCase().includes(term) ||
        j.destination?.toLowerCase().includes(term) ||
        j.vehicles?.plate?.toLowerCase().includes(term) ||
        j.drivers?.name?.toLowerCase().includes(term) ||
        j.parties?.name?.toLowerCase().includes(term)
      );
    }
    if (statusFilter !== 'all') result = result.filter(j => j.status === statusFilter);
    if (vehicleFilter !== 'all') result = result.filter(j => j.vehicle_id === vehicleFilter);
    if (driverFilter !== 'all') result = result.filter(j => j.driver_id === driverFilter);
    return result;
  }, [journeys, searchTerm, statusFilter, vehicleFilter, driverFilter]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, vehicleFilter, driverFilter]);

  const totalPages = Math.ceil(filteredJourneys.length / PAGE_SIZE);
  const paginatedJourneys = filteredJourneys.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => ({
    total: filteredJourneys.length,
    inProgress: filteredJourneys.filter(j => j.status === 'in_progress').length,
    totalRevenue: filteredJourneys.reduce((sum, j) => sum + (j.actualRevenue || 0), 0),
    totalKm: filteredJourneys.reduce((sum, j) => sum + (j.distance || 0), 0),
  }), [filteredJourneys]);

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || vehicleFilter !== 'all' || driverFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setVehicleFilter('all');
    setDriverFilter('all');
  };

  const handleDuplicate = (journey: Journey) => {
    setEditingJourney(null);
    setFormData({
      journey_number: '',
      origin: journey.origin || '',
      destination: journey.destination || '',
      distance: journey.distance != null ? String(journey.distance) : '',
      freight_value: journey.freight_value != null ? String(journey.freight_value) : '',
      freight_status: 'pending',
      freight_received_date: '',
      freight_due_date: '',
      commission_percentage: journey.commission_percentage != null ? String(journey.commission_percentage) : '',
      advance_value: journey.advance_value != null ? String(journey.advance_value) : '',
      vehicle_id: journey.vehicle_id || '',
      driver_id: journey.driver_id || '',
      customer_id: journey.customer_id || '',
      status: 'planned',
      start_date: '',
      start_km: '',
      end_date: '',
      end_km: '',
      notes: journey.notes || ''
    });
    setDialogOpen(true);
  };

  const fetchNextJourneyKm = async (vehicleId: string, currentJourneyStartDate: string | null): Promise<{ journey_number: string; start_km: number } | null> => {
    try {
      const { data, error } = await supabase
        .from('journeys')
        .select('journey_number, start_km, start_date')
        .eq('vehicle_id', vehicleId)
        .not('start_km', 'is', null)
        .gt('start_date', currentJourneyStartDate || '1970-01-01')
        .order('start_date', { ascending: true })
        .limit(1);

      if (error || !data || data.length === 0) return null;
      return { journey_number: data[0].journey_number, start_km: data[0].start_km! };
    } catch {
      return null;
    }
  };

  const openCompleteDialog = async (journey: Journey) => {
    setCompletingJourney(journey);
    setEndKm('');
    setCompletionNotes('');
    setSuggestedEndKm(null);
    setNextJourneyInfo(null);
    setCompleteDialogOpen(true);

    // Buscar próxima jornada do veículo para sugestão
    if (journey.vehicle_id && journey.start_date) {
      setLoadingSuggestion(true);
      const nextJourney = await fetchNextJourneyKm(journey.vehicle_id, journey.start_date);
      if (nextJourney?.start_km) {
        setSuggestedEndKm(nextJourney.start_km);
        setNextJourneyInfo(nextJourney);
        setEndKm(nextJourney.start_km.toString()); // Pré-preencher
      }
      setLoadingSuggestion(false);
    }
  };

  const handleCompleteJourney = async () => {
    if (!completingJourney) return;

    const endKmValue = Number(endKm);
    const startKmValue = completingJourney.start_km || 0;

    if (!endKm || endKmValue <= 0) {
      toast({ 
        title: 'Erro', 
        description: 'Informe o hodômetro final',
        variant: 'destructive'
      });
      return;
    }

    if (startKmValue > 0 && endKmValue <= startKmValue) {
      toast({ 
        title: 'Erro', 
        description: `Hodômetro final deve ser maior que o inicial (${startKmValue.toLocaleString('pt-BR')} km)`,
        variant: 'destructive'
      });
      return;
    }

    setIsCompleting(true);
    try {
      const distanceCalculated = startKmValue > 0 ? endKmValue - startKmValue : null;

      // Montar nota de encerramento com info de sugestão
      const usedSuggestion = suggestedEndKm && endKmValue === suggestedEndKm;
      let closureNote = usedSuggestion 
        ? `Encerrada com KM da jornada ${nextJourneyInfo?.journey_number}`
        : (completionNotes || 'Encerrada pelo administrador');
      
      // Adicionar info de discrepância se houver
      if (kmDiscrepancy !== 0 && !usedSuggestion && suggestedEndKm) {
        closureNote += ` | Diferença: ${Math.abs(kmDiscrepancy).toLocaleString('pt-BR')} km ${kmDiscrepancy > 0 ? 'não contabilizados' : 'além do esperado'}`;
      }

      const { error } = await supabase
        .from('journeys')
        .update({
          status: 'completed',
          end_km: endKmValue,
          end_date: new Date().toISOString(),
          closed_at: new Date().toISOString(),
          closed_by: user?.id,
          closure_notes: closureNote,
          distance: distanceCalculated || completingJourney.distance
        })
        .eq('id', completingJourney.id);

      if (error) throw error;

      // Marcar todos os trechos como concluídos
      await supabase
        .from('journey_legs')
        .update({ status: 'completed' })
        .eq('journey_id', completingJourney.id);

      toast({ 
        title: 'Sucesso', 
        description: `Jornada ${completingJourney.journey_number} concluída!` 
      });
      setCompleteDialogOpen(false);
      setCompletingJourney(null);
      fetchJourneys();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsCompleting(false);
    }
  };

  if (loading || !currentCompany?.id) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jornadas</h1>
          <p className="text-muted-foreground">Gerencie as jornadas da sua frota</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary shadow-primary" onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Jornada
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingJourney ? 'Editar Jornada' : 'Nova Jornada'}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Seção de Importação de CT-e */}
              {!editingJourney && (
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Como deseja criar a jornada?</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={importMode === 'manual' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleModeChange('manual')}
                        className="flex-1"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Manual
                      </Button>
                      <Button
                        type="button"
                        variant={importMode === 'import' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleModeChange('import')}
                        className="flex-1"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Importar CT-e
                      </Button>
                    </div>
                  </div>

                  {importMode === 'import' && (
                    <div className="space-y-3 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Arraste os arquivos XML dos CT-es ou clique para selecionar. Você pode importar múltiplos arquivos.
                      </p>
                      
                      {/* Área de upload / drop zone */}
                      <div
                        className={cn(
                          "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer",
                          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                        )}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".xml"
                          multiple
                          className="hidden"
                          onChange={handleFileSelect}
                        />
                        {importLoading ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Processando...</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="h-6 w-6 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              Arraste arquivos XML aqui ou clique para selecionar
                            </p>
                          </div>
                        )}
                      </div>

                      {importedCTes.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              CT-es Importados ({importedCTes.length})
                            </Label>
                            <span className="text-xs font-medium text-green-600">
                              Total: R$ {importedCTes.reduce((s, c) => s + c.freightValue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="border rounded-lg divide-y max-h-32 overflow-y-auto bg-background">
                            {importedCTes.map((cte) => (
                              <div key={cte.accessKey} className="flex items-center justify-between p-2 text-xs hover:bg-muted/50">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <span className="font-medium">CT-e {cte.cteNumber || cte.accessKey.slice(0, 12)}</span>
                                    <div className="text-muted-foreground truncate text-[10px]">
                                      {cte.origin} → {cte.destination}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-green-600 font-medium">
                                    R$ {cte.freightValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveCTe(cte.accessKey);
                                    }}
                                  >
                                    <X className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="journey_number">Número da Jornada</Label>
                  <Input
                    id="journey_number"
                    value={formData.journey_number}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, journey_number: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, status: value as any }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planejada</SelectItem>
                      <SelectItem value="in_progress">Em Andamento</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {legs.length > 1 ? (
                <>
                  {/* Multi-leg mode: JourneyLegsEditor handles origin/dest/freight per leg */}
                  <JourneyLegsEditor legs={legs} onLegsChange={handleLegsChange} />

                  {/* Summary: total freight (read-only) */}
                  <div className="border rounded-lg p-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Frete Total (soma dos trechos)</span>
                      <span className="text-lg font-bold">{formatCurrency(parseFloat(formData.freight_value) || 0)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="origin">Origem</Label>
                      <Input
                        id="origin"
                        value={formData.origin}
                        onChange={(e) => {
                          setFormData((prev) => ({ ...prev, origin: e.target.value }));
                          setLegs(prev => [{ ...prev[0], origin: e.target.value }]);
                        }}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="destination">Destino</Label>
                      <Input
                        id="destination"
                        value={formData.destination}
                        onChange={(e) => {
                          setFormData((prev) => ({ ...prev, destination: e.target.value }));
                          setLegs(prev => [{ ...prev[0], destination: e.target.value }]);
                        }}
                        required
                      />
                    </div>
                  </div>

                  <JourneyLegsEditor legs={legs} onLegsChange={handleLegsChange} />
                </>
              )}

              {/* Vehicle/Coupling Selector */}
              <JourneyVehicleSelector
                vehicles={[...allTrucks, ...allTrailers]}
                activeCouplings={activeCouplings}
                savedCouplings={savedCouplings}
                availableTrucks={availableTrucks}
                availableTrailers={availableTrailers}
                selectedVehicleId={formData.vehicle_id || null}
                selectedCouplingId={selectedCouplingId}
                onVehicleSelect={(vehicleId) =>
                  setFormData((prev) => ({ ...prev, vehicle_id: vehicleId || '' }))
                }
                onCouplingSelect={setSelectedCouplingId}
                onNewCouplingCreate={handleNewCouplingCreate}
              />

              <div className="space-y-2">
                <Label htmlFor="driver_id">Motorista</Label>
                <Select
                  value={formData.driver_id}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, driver_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um motorista" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers
                      .filter((d) => d && d.id != null && String(d.id).trim() !== '')
                      .map((driver) => (
                        <SelectItem
                          key={String(driver.id)}
                          value={String(driver.id)}
                        >
                          {driver.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Seletor de Cliente - only show when single leg */}
              {legs.length <= 1 && (
                <div className="space-y-2">
                  <Label htmlFor="customer_id">Cliente</Label>
                  <PartySelector
                    type="customer"
                    value={formData.customer_id || undefined}
                    onChange={(id) => setFormData((prev) => ({ ...prev, customer_id: id || '' }))}
                    placeholder="Selecione o cliente (opcional)"
                    allowCreate
                    onCreateNew={() => window.open('/parties?tab=customer', '_blank')}
                  />
                </div>
              )}

              {/* Seção Faturamento do Frete - only show for single leg */}
              {legs.length <= 1 && (
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    📦 Faturamento do Frete
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="freight_value">Valor do Frete (R$)</Label>
                      <Input
                        id="freight_value"
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={formData.freight_value}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, freight_value: e.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="freight_status">Status do Recebimento</Label>
                      <Select
                        value={formData.freight_status}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, freight_status: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="received">Recebido</SelectItem>
                          <SelectItem value="invoiced">Faturado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      {formData.freight_status === 'received' ? (
                        <>
                          <Label htmlFor="freight_received_date">Data do Recebimento</Label>
                          <Input
                            id="freight_received_date"
                            type="date"
                            value={formData.freight_received_date}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, freight_received_date: e.target.value }))
                            }
                          />
                        </>
                      ) : (
                        <>
                          <Label htmlFor="freight_due_date">Data de Vencimento</Label>
                          <Input
                            id="freight_due_date"
                            type="date"
                            value={formData.freight_due_date}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, freight_due_date: e.target.value }))
                            }
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="distance">Distância (km)</Label>
                  <Input
                    id="distance"
                    type="number"
                    step="0.01"
                    value={formData.distance}
                    onChange={(e) => setFormData((prev) => ({ ...prev, distance: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="commission_percentage">Comissão (%)</Label>
                  <Input
                    id="commission_percentage"
                    type="number"
                    step="0.01"
                    value={formData.commission_percentage}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        commission_percentage: e.target.value
                      }))
                    }
                  />
                  {calculatedCommissionValue > 0 && (
                    <p className="text-xs text-muted-foreground">
                      💰 Valor da Comissão: {formatCurrency(calculatedCommissionValue)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="advance_value">Adiantamento</Label>
                  <Input
                    id="advance_value"
                    type="number"
                    step="0.01"
                    value={formData.advance_value}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, advance_value: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data de Início</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, start_date: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start_km">Km Inicial</Label>
                  <Input
                    id="start_km"
                    type="number"
                    value={formData.start_km}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, start_km: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  {/* Placeholder para alinhamento */}
                </div>
              </div>

              {/* Campos condicionais para status "Concluída" */}
              {formData.status === 'completed' && (
                <div className="border rounded-lg p-4 space-y-4 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Campos de Encerramento (Obrigatórios)
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="end_date" className="text-amber-800 dark:text-amber-200">
                        Data de Encerramento *
                      </Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, end_date: e.target.value }))
                        }
                        required={formData.status === 'completed'}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="end_km" className="text-amber-800 dark:text-amber-200">
                        KM Final *
                      </Label>
                      <Input
                        id="end_km"
                        type="number"
                        value={formData.end_km}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, end_km: e.target.value }))
                        }
                        required={formData.status === 'completed'}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-gradient-primary">
                  {editingJourney ? 'Atualizar' : 'Cadastrar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Todas as Jornadas</TabsTrigger>
          <TabsTrigger value="approvals" className="relative">
            Aprovação de Jornadas
            {approvalRequestsCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-orange-500 text-white text-xs font-bold">
                {approvalRequestsCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="closures" className="relative">
            Solicitações de Fechamento
            {closureRequestsCount > 0 && (
              <Badge 
                variant="destructive" 
                className="ml-2 h-5 min-w-5 px-1.5 flex items-center justify-center text-xs"
              >
                {closureRequestsCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Route className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Jornadas</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Activity className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Em Andamento</p>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Receita Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <MapPin className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">KM Rodados</p>
                  <p className="text-2xl font-bold">{stats.totalKm.toLocaleString('pt-BR')}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número, rota, placa, motorista..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="planned">Planejada</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Veículos</SelectItem>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={driverFilter} onValueChange={setDriverFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Motorista" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Motoristas</SelectItem>
                    {drivers.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="whitespace-nowrap">
                    <X className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Table or Empty State */}
          <Card className="shadow-card">
            <CardContent className="p-0">
              {paginatedJourneys.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <Truck className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">Nenhuma jornada encontrada</h3>
                  <p className="text-muted-foreground text-sm mt-1 text-center max-w-sm">
                    {hasActiveFilters
                      ? 'Nenhuma jornada corresponde aos filtros aplicados.'
                      : 'Crie sua primeira jornada para começar a gerenciar sua frota.'}
                  </p>
                  <div className="mt-4">
                    {hasActiveFilters ? (
                      <Button variant="outline" onClick={clearFilters}>
                        <Filter className="h-4 w-4 mr-2" />
                        Limpar Filtros
                      </Button>
                    ) : (
                      <Button className="bg-gradient-primary shadow-primary" onClick={() => { resetForm(); setDialogOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Jornada
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Rota</TableHead>
                        <TableHead>Veículo</TableHead>
                        <TableHead>Motorista</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>CT-e</TableHead>
                        <TableHead className="w-[50px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedJourneys.map((journey) => (
                        <TableRow key={journey.id}>
                          <TableCell className="font-medium">{journey.journey_number}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">
                                {journey.origin} → {journey.destination}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Truck className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {journey.vehicles?.plate || 'N/A'}
                                </span>
                                {journey.vehicle_couplings && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Link2 className="h-2.5 w-2.5" />
                                    {journey.vehicle_couplings.coupling_type === 'simple' ? 'Simples' :
                                     journey.vehicle_couplings.coupling_type === 'bitrem' ? 'Bitrem' : 'Rodotrem'}
                                    {' • '}
                                    {journey.vehicle_couplings.vehicle_coupling_items
                                      ?.map(item => item.vehicles?.plate)
                                      .filter(Boolean)
                                      .join(' + ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{journey.drivers?.name || 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{journey.parties?.name || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{formatCurrency(journey.actualRevenue || 0)}</span>
                              {journey.freight_value && journey.freight_value !== (journey.actualRevenue || 0) && (
                                <span className="text-xs text-muted-foreground">
                                  Planejado: {formatCurrency(journey.freight_value)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(journey.status)}>
                              {getStatusText(journey.status)}
                            </Badge>
                            {(journey as any).created_by_driver && (
                              <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">Motorista</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {journey.cte_documents && journey.cte_documents.length > 0 ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                CT-e {journey.cte_documents[0].cte_number || 'Importado'}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setViewingJourney(journey); setDetailsDialogOpen(true); }}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver Detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(journey)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                {(journey.status === 'planned' || journey.status === 'in_progress') && (
                                  <DropdownMenuItem onClick={() => openCompleteDialog(journey)}>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Concluir
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleDuplicate(journey)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openDeleteDialog(journey.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <p className="text-sm text-muted-foreground">
                        Mostrando {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredJourneys.length)} de {filteredJourneys.length} jornadas
                      </p>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                          </PaginationItem>
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let page: number;
                            if (totalPages <= 5) {
                              page = i + 1;
                            } else if (currentPage <= 3) {
                              page = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              page = totalPages - 4 + i;
                            } else {
                              page = currentPage - 2 + i;
                            }
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(page)}
                                  isActive={currentPage === page}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          })}
                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Jornadas Aguardando Aprovação</CardTitle>
              <CardDescription>Jornadas criadas por motoristas que precisam da sua aprovação para iniciar.</CardDescription>
            </CardHeader>
            <CardContent>
              {journeys.filter(j => j.status === 'pending_approval').length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma jornada pendente de aprovação.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Rota</TableHead>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Motorista</TableHead>
                      <TableHead>KM Inicial</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journeys.filter(j => j.status === 'pending_approval').map(journey => (
                      <TableRow key={journey.id}>
                        <TableCell className="font-medium">{journey.journey_number}</TableCell>
                        <TableCell>{journey.origin} → {journey.destination}</TableCell>
                        <TableCell>{journey.vehicles?.plate || '-'}</TableCell>
                        <TableCell>{journey.drivers?.name || '-'}</TableCell>
                        <TableCell>{journey.start_km?.toLocaleString('pt-BR') || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={async () => {
                                const { error } = await supabase.from('journeys').update({ status: 'in_progress' }).eq('id', journey.id);
                                if (!error) { sonnerToast.success('Jornada aprovada!'); fetchJourneys(); refreshApprovals(); }
                                else sonnerToast.error('Erro: ' + error.message);
                              }}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" /> Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={async () => {
                                const { error } = await supabase.from('journeys').update({ status: 'cancelled' }).eq('id', journey.id);
                                if (!error) { sonnerToast.success('Jornada rejeitada.'); fetchJourneys(); refreshApprovals(); }
                                else sonnerToast.error('Erro: ' + error.message);
                              }}
                            >
                              <X className="h-3 w-3 mr-1" /> Rejeitar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="closures">
          <ClosureApprovalPanel />
        </TabsContent>
      </Tabs>


      {/* Dialog de Detalhes da Jornada com Tabs */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalhes da Jornada {viewingJourney?.journey_number}
            </DialogTitle>
          </DialogHeader>
          
          {viewingJourney && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="fuel">Abastecimentos</TabsTrigger>
                <TabsTrigger value="expenses">Despesas</TabsTrigger>
                <TabsTrigger value="revenues">Receitas</TabsTrigger>
                <TabsTrigger value="receipts">
                  <FileImage className="h-3.5 w-3.5 mr-1" />
                  Comprovantes{receiptCount > 0 ? ` (${receiptCount})` : ''}
                </TabsTrigger>
                <TabsTrigger value="checklists">Checklists</TabsTrigger>
                <TabsTrigger value="financial">Resumo</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="space-y-4">
                {/* Trechos da jornada */}
                {detailsLegs.length > 1 ? (
                  <div className="space-y-3">
                    <Label className="text-muted-foreground">Rota ({detailsLegs.length} trechos)</Label>
                    <p className="font-medium text-lg">
                      {buildRouteString(detailsLegs)}
                    </p>
                    <div className="space-y-2">
                      {detailsLegs.map((leg, i) => (
                        <div key={i} className="border rounded-lg p-3 bg-muted/20">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-muted-foreground uppercase">
                                Trecho {leg.leg_number} {i === 0 ? '(Ida)' : i === 1 ? '(Retorno)' : ''}
                              </span>
                              <Badge
                                variant={(leg as any).status === 'in_progress' ? 'default' : (leg as any).status === 'completed' ? 'secondary' : 'outline'}
                                className={`text-xs ${(leg as any).status === 'in_progress' ? 'bg-primary' : (leg as any).status === 'completed' ? 'bg-green-100 text-green-800' : ''}`}
                              >
                                {(leg as any).status === 'in_progress' ? 'Ativo' : (leg as any).status === 'completed' ? 'Concluído' : 'Pendente'}
                              </Badge>
                            </div>
                            {leg.freight_value && parseFloat(leg.freight_value) > 0 && (
                              <span className="font-semibold text-sm">{formatCurrency(parseFloat(leg.freight_value))}</span>
                            )}
                          </div>
                          <p className="font-medium mt-1">{leg.origin} → {leg.destination}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Rota</Label>
                      <p className="font-medium">{viewingJourney.origin} → {viewingJourney.destination}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      <Badge className={getStatusColor(viewingJourney.status)}>
                        {getStatusText(viewingJourney.status)}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Veículo</Label>
                    <p className="font-medium">
                      {viewingJourney.vehicles 
                        ? `${viewingJourney.vehicles.plate} - ${viewingJourney.vehicles.model}` 
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Motorista</Label>
                    <p className="font-medium">{viewingJourney.drivers?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Valor do Frete</Label>
                    <p className="font-medium">{formatCurrency(viewingJourney.freight_value)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Distância</Label>
                    <p className="font-medium">
                      {viewingJourney.distance ? `${viewingJourney.distance} km` : 'N/A'}
                    </p>
                  </div>
                  
                  {/* Localização de Início */}
                  {(viewingJourney.start_location_lat || viewingJourney.start_location_address) && (
                    <div>
                      <Label className="text-muted-foreground">📍 Local de Início</Label>
                      <div className="mt-1">
                        <LocationDisplay
                          lat={viewingJourney.start_location_lat}
                          lng={viewingJourney.start_location_lng}
                          address={viewingJourney.start_location_address}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Localização de Fim */}
                  {(viewingJourney.end_location_lat || viewingJourney.end_location_address) && (
                    <div>
                      <Label className="text-muted-foreground">📍 Local de Término</Label>
                      <div className="mt-1">
                        <LocationDisplay
                          lat={viewingJourney.end_location_lat}
                          lng={viewingJourney.end_location_lng}
                          address={viewingJourney.end_location_address}
                        />
                      </div>
                    </div>
                  )}
                  
                  {viewingJourney.notes && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">Observações</Label>
                      <p className="font-medium">{viewingJourney.notes}</p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="fuel">
                <JourneyFuelExpenses 
                  journeyId={viewingJourney.id}
                  vehicleId={viewingJourney.vehicle_id || ''}
                  distance={viewingJourney.distance || undefined}
                  journeyStartKm={viewingJourney.start_km || undefined}
                />
              </TabsContent>
              
              <TabsContent value="expenses">
                <JourneyExpenses journeyId={viewingJourney.id} />
              </TabsContent>
              
              <TabsContent value="revenues">
                <JourneyRevenues 
                  journeyId={viewingJourney.id}
                  journeyNumber={viewingJourney.journey_number}
                  freightValue={viewingJourney.freight_value}
                />
              </TabsContent>
              
              <TabsContent value="receipts">
                <JourneyReceipts journeyId={viewingJourney.id} />
              </TabsContent>

              <TabsContent value="checklists">
                <JourneyChecklistView journeyId={viewingJourney.id} />
              </TabsContent>
              
              <TabsContent value="financial">
                <JourneyFinancialSummary journeyId={viewingJourney.id} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Conclusão de Jornada */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Concluir Jornada
            </DialogTitle>
          </DialogHeader>
          
          {completingJourney && (
            <div className="space-y-4">
              {/* Info da jornada */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jornada:</span>
                  <span className="font-medium">{completingJourney.journey_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Veículo:</span>
                  <span className="font-medium">
                    {completingJourney.vehicles 
                      ? `${completingJourney.vehicles.plate}` 
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Motorista:</span>
                  <span className="font-medium">{completingJourney.drivers?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rota:</span>
                  <span className="font-medium">{completingJourney.origin} → {completingJourney.destination}</span>
                </div>
              </div>

              {/* KM Inicial (readonly) */}
              {completingJourney.start_km && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">KM Inicial da Jornada</Label>
                  <Input 
                    value={completingJourney.start_km.toLocaleString('pt-BR')} 
                    disabled 
                    className="bg-muted"
                  />
                </div>
              )}

              {/* Sugestão baseada na próxima jornada */}
              {loadingSuggestion && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  Buscando sugestão de KM...
                </div>
              )}

              {nextJourneyInfo && !loadingSuggestion && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950 dark:border-blue-800">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm">
                    <Info className="h-4 w-4" />
                    <span className="font-medium">Sugestão automática</span>
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    A próxima jornada ({nextJourneyInfo.journey_number}) deste veículo 
                    inicia com {nextJourneyInfo.start_km.toLocaleString('pt-BR')} km
                  </p>
                  {Number(endKm) !== suggestedEndKm && (
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => setEndKm(suggestedEndKm!.toString())}
                    >
                      Usar sugestão
                    </Button>
                  )}
                </div>
              )}

              {/* Hodômetro Final */}
              <div className="space-y-2">
                <Label htmlFor="end_km">Hodômetro Final (km) *</Label>
                <Input
                  id="end_km"
                  type="number"
                  placeholder="Ex: 150000"
                  value={endKm}
                  onChange={(e) => setEndKm(e.target.value)}
                  autoFocus={!nextJourneyInfo}
                />
                {endKm && completingJourney.start_km && Number(endKm) > completingJourney.start_km && (
                  <p className="text-xs text-muted-foreground">
                    Distância percorrida: {(Number(endKm) - completingJourney.start_km).toLocaleString('pt-BR')} km
                  </p>
                )}
              </div>

              {/* Alerta de discrepância */}
              {kmDiscrepancy !== 0 && suggestedEndKm && endKm && (
                <Alert variant={kmDiscrepancy < 0 ? "destructive" : "default"} className={kmDiscrepancy > 0 ? "border-amber-500 bg-amber-50 dark:bg-amber-950" : ""}>
                  {kmDiscrepancy > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription className={kmDiscrepancy > 0 ? "text-amber-800 dark:text-amber-200" : ""}>
                    {kmDiscrepancy > 0 ? (
                      <>
                        <strong>{Math.abs(kmDiscrepancy).toLocaleString('pt-BR')} km não contabilizados</strong>
                        <br />
                        <span className="text-xs">
                          O hodômetro informado é menor que o início da próxima jornada.
                          Pode indicar uso do veículo entre jornadas.
                        </span>
                      </>
                    ) : (
                      <>
                        <strong>Hodômetro maior que a próxima jornada</strong>
                        <br />
                        <span className="text-xs">
                          O valor informado ({Number(endKm).toLocaleString('pt-BR')} km) é maior que o início 
                          da jornada {nextJourneyInfo?.journey_number} ({suggestedEndKm?.toLocaleString('pt-BR')} km). Verifique.
                        </span>
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Observações */}
              <div className="space-y-2">
                <Label htmlFor="completion_notes">Observações (opcional)</Label>
                <Textarea
                  id="completion_notes"
                  placeholder="Observações sobre o encerramento..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setCompleteDialogOpen(false)}
                  disabled={isCompleting}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCompleteJourney}
                  disabled={isCompleting || !endKm}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isCompleting ? 'Concluindo...' : 'Concluir Jornada'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Excluir jornada?"
        description="Esta jornada e suas receitas vinculadas serão removidas permanentemente. Esta ação não pode ser desfeita."
        isDeleting={isDeleting}
      />
    </div>
  );
}
