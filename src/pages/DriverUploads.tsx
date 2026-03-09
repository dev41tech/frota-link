import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  CalendarIcon, 
  Eye, 
  FileImage, 
  Download, 
  Fuel, 
  Receipt, 
  DollarSign, 
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Truck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Upload {
  id: string;
  date: string;
  amount: number;
  type: 'fuel' | 'expense';
  category?: string;
  receipt_url: string;
  driver_name: string;
  vehicle_plate: string;
  vehicle_model: string;
}

const ITEMS_PER_PAGE = 12;

export default function DriverUploads() {
  const { currentCompany } = useMultiTenant();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedDriver, setSelectedDriver] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Pagination
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  
  // Modal
  const [selectedUpload, setSelectedUpload] = useState<Upload | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  useEffect(() => {
    if (currentCompany) {
      fetchDrivers();
      fetchUploads();
    }
  }, [currentCompany]);

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('company_id', currentCompany!.id)
      .order('name');
    
    if (error) {
      console.error('Erro ao buscar motoristas:', error);
      return;
    }
    setDrivers(data || []);
  };

  const fetchUploads = async () => {
    setLoading(true);
    try {
      // Buscar combustível com comprovantes - usando left join para não excluir registros
      const { data: fuelData, error: fuelError } = await supabase
        .from('fuel_expenses')
        .select(`
          id,
          date,
          total_amount,
          receipt_url,
          vehicle_id,
          vehicles(id, plate, model)
        `)
        .eq('company_id', currentCompany!.id)
        .not('receipt_url', 'is', null)
        .order('date', { ascending: false });

      if (fuelError) throw fuelError;

      // Buscar despesas com comprovantes
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .select(`
          id,
          date,
          amount,
          category,
          receipt_url,
          vehicle_id,
          vehicles(id, plate, model)
        `)
        .eq('company_id', currentCompany!.id)
        .not('receipt_url', 'is', null)
        .order('date', { ascending: false });

      if (expenseError) throw expenseError;

      // Buscar driver_vehicles para associar motoristas
      const vehicleIds = [
        ...(fuelData || []).map((f: any) => f.vehicle_id),
        ...(expenseData || []).map((e: any) => e.vehicle_id)
      ].filter(Boolean);

      const { data: driverVehiclesData } = await supabase
        .from('driver_vehicles')
        .select('vehicle_id, drivers(id, name)')
        .eq('company_id', currentCompany!.id)
        .eq('status', 'active')
        .in('vehicle_id', vehicleIds.length > 0 ? vehicleIds : ['00000000-0000-0000-0000-000000000000']);

      // Criar mapa de vehicle_id -> driver_name
      const vehicleDriverMap: Record<string, string> = {};
      (driverVehiclesData || []).forEach((dv: any) => {
        if (dv.vehicle_id && dv.drivers?.name) {
          vehicleDriverMap[dv.vehicle_id] = dv.drivers.name;
        }
      });

      const fuelUploads: Upload[] = (fuelData || []).map((item: any) => ({
        id: item.id,
        date: item.date,
        amount: item.total_amount,
        type: 'fuel' as const,
        receipt_url: item.receipt_url,
        driver_name: item.vehicle_id ? (vehicleDriverMap[item.vehicle_id] || 'N/A') : 'N/A',
        vehicle_plate: item.vehicles?.plate || 'N/A',
        vehicle_model: item.vehicles?.model || 'N/A',
      }));

      const expenseUploads: Upload[] = (expenseData || []).map((item: any) => ({
        id: item.id,
        date: item.date,
        amount: item.amount,
        type: 'expense' as const,
        category: item.category,
        receipt_url: item.receipt_url,
        driver_name: item.vehicle_id ? (vehicleDriverMap[item.vehicle_id] || 'N/A') : 'N/A',
        vehicle_plate: item.vehicles?.plate || 'N/A',
        vehicle_model: item.vehicles?.model || 'N/A',
      }));

      const allUploads = [...fuelUploads, ...expenseUploads].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      console.log('Comprovantes encontrados:', allUploads.length);
      setUploads(allUploads);
    } catch (error) {
      console.error('Erro ao buscar comprovantes:', error);
      toast.error('Erro ao carregar comprovantes');
    } finally {
      setLoading(false);
    }
  };

  const filteredUploads = useMemo(() => {
    let filtered = [...uploads];

    if (selectedDriver !== "all") {
      filtered = filtered.filter(u => 
        drivers.find(d => d.id === selectedDriver)?.name === u.driver_name
      );
    }

    if (selectedType !== "all") {
      filtered = filtered.filter(u => u.type === selectedType);
    }

    if (startDate) {
      filtered = filtered.filter(u => new Date(u.date) >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter(u => new Date(u.date) <= endDate);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        u.driver_name.toLowerCase().includes(query) ||
        u.vehicle_plate.toLowerCase().includes(query) ||
        u.vehicle_model.toLowerCase().includes(query) ||
        (u.category && u.category.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [uploads, selectedDriver, selectedType, startDate, endDate, searchQuery, drivers]);

  const stats = useMemo(() => {
    const totalValue = filteredUploads.reduce((sum, u) => sum + u.amount, 0);
    const fuelUploads = filteredUploads.filter(u => u.type === 'fuel');
    const expenseUploads = filteredUploads.filter(u => u.type === 'expense');
    const fuelValue = fuelUploads.reduce((sum, u) => sum + u.amount, 0);
    const expenseValue = expenseUploads.reduce((sum, u) => sum + u.amount, 0);

    return {
      total: filteredUploads.length,
      totalValue,
      fuelCount: fuelUploads.length,
      fuelValue,
      expenseCount: expenseUploads.length,
      expenseValue,
    };
  }, [filteredUploads]);

  const visibleUploads = filteredUploads.slice(0, visibleCount);
  const hasMore = visibleCount < filteredUploads.length;

  const clearFilters = () => {
    setSelectedDriver("all");
    setSelectedType("all");
    setStartDate(undefined);
    setEndDate(undefined);
    setSearchQuery("");
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const hasActiveFilters = selectedDriver !== "all" || selectedType !== "all" || startDate || endDate || searchQuery;

  const handleViewUpload = (upload: Upload, index: number) => {
    setSelectedUpload(upload);
    setSelectedIndex(index);
  };

  const navigateUpload = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? selectedIndex - 1 : selectedIndex + 1;
    if (newIndex >= 0 && newIndex < visibleUploads.length) {
      setSelectedUpload(visibleUploads[newIndex]);
      setSelectedIndex(newIndex);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Comprovantes dos Motoristas</h1>
          <p className="text-muted-foreground mt-1">
            Visualize todos os comprovantes enviados pelos motoristas
          </p>
        </div>
        <FileImage className="h-8 w-8 text-primary" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <FileImage className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-xl font-bold">R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Fuel className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Combustível</p>
                <p className="text-lg font-bold">{stats.fuelCount}</p>
                <p className="text-xs text-muted-foreground">R$ {stats.fuelValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Receipt className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Despesas</p>
                <p className="text-lg font-bold">{stats.expenseCount}</p>
                <p className="text-xs text-muted-foreground">R$ {stats.expenseValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compact Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-end">
            {/* Search */}
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por motorista, placa ou categoria..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Driver Filter */}
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Motorista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos motoristas</SelectItem>
                {drivers.map(driver => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="fuel">Combustível</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>

            {/* Start Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full md:w-[150px] justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yy") : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* End Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full md:w-[150px] justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd/MM/yy") : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters} title="Limpar filtros">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <span>Filtros ativos:</span>
              {searchQuery && <Badge variant="secondary">Busca: {searchQuery}</Badge>}
              {selectedDriver !== "all" && (
                <Badge variant="secondary">
                  {drivers.find(d => d.id === selectedDriver)?.name}
                </Badge>
              )}
              {selectedType !== "all" && (
                <Badge variant="secondary">
                  {selectedType === 'fuel' ? 'Combustível' : 'Despesa'}
                </Badge>
              )}
              {startDate && <Badge variant="secondary">De: {format(startDate, "dd/MM")}</Badge>}
              {endDate && <Badge variant="secondary">Até: {format(endDate, "dd/MM")}</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-40 w-full" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <div className="flex justify-between items-center pt-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredUploads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-muted/50 rounded-full mb-4">
              <FileImage className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Nenhum comprovante encontrado</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              {hasActiveFilters 
                ? "Tente ajustar os filtros para encontrar o que procura"
                : "Os comprovantes enviados pelos motoristas aparecerão aqui"}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleUploads.map((upload, index) => (
              <Card 
                key={`${upload.type}-${upload.id}`} 
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => handleViewUpload(upload, index)}
              >
                {/* Thumbnail */}
                <div className="relative h-40 bg-muted overflow-hidden">
                  <img
                    src={upload.receipt_url}
                    alt="Comprovante"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder.svg';
                    }}
                  />
                  <div className="absolute top-2 left-2">
                    <Badge 
                      variant={upload.type === 'fuel' ? 'default' : 'secondary'}
                      className={cn(
                        upload.type === 'fuel' 
                          ? 'bg-blue-500 hover:bg-blue-600' 
                          : 'bg-orange-500 hover:bg-orange-600 text-white'
                      )}
                    >
                      {upload.type === 'fuel' ? (
                        <><Fuel className="h-3 w-3 mr-1" /> Combustível</>
                      ) : (
                        <><Receipt className="h-3 w-3 mr-1" /> Despesa</>
                      )}
                    </Badge>
                  </div>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button variant="secondary" size="sm">
                      <Eye className="h-4 w-4 mr-1" /> Ver detalhes
                    </Button>
                  </div>
                </div>

                {/* Card Content */}
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <CalendarIcon className="h-3 w-3" />
                    {format(new Date(upload.date), "dd/MM/yyyy", { locale: ptBR })}
                  </div>
                  
                  <p className="font-medium truncate">{upload.driver_name}</p>
                  
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Truck className="h-3 w-3" />
                    <span className="truncate">{upload.vehicle_plate} - {upload.vehicle_model}</span>
                  </div>

                  {upload.category && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {upload.category}
                    </p>
                  )}

                  <div className="flex justify-between items-center mt-3 pt-3 border-t">
                    <span className="text-lg font-bold text-primary">
                      R$ {upload.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button 
                variant="outline" 
                onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                className="px-8"
              >
                Carregar mais ({filteredUploads.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </>
      )}

      {/* View Modal */}
      <Dialog open={!!selectedUpload} onOpenChange={() => setSelectedUpload(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Comprovante</span>
              <div className="flex items-center gap-2 mr-8">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navigateUpload('prev')}
                  disabled={selectedIndex <= 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedIndex + 1} de {visibleUploads.length}
                </span>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navigateUpload('next')}
                  disabled={selectedIndex >= visibleUploads.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedUpload && (
            <div className="flex flex-col lg:flex-row gap-6 overflow-hidden flex-1">
              {/* Image */}
              <div className="flex-1 min-h-0 bg-muted rounded-lg overflow-hidden">
                <img
                  src={selectedUpload.receipt_url}
                  alt="Comprovante"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder.svg';
                  }}
                />
              </div>

              {/* Details */}
              <div className="lg:w-72 flex-shrink-0 space-y-4">
                <div className="space-y-3">
                  <Badge 
                    className={cn(
                      "w-fit",
                      selectedUpload.type === 'fuel' 
                        ? 'bg-blue-500 hover:bg-blue-600' 
                        : 'bg-orange-500 hover:bg-orange-600'
                    )}
                  >
                    {selectedUpload.type === 'fuel' ? 'Combustível' : 'Despesa'}
                  </Badge>

                  <div className="text-3xl font-bold text-primary">
                    R$ {selectedUpload.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(selectedUpload.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="p-1.5 bg-muted rounded">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedUpload.driver_name}</p>
                      <p className="text-muted-foreground">
                        {selectedUpload.vehicle_plate} - {selectedUpload.vehicle_model}
                      </p>
                    </div>
                  </div>

                  {selectedUpload.category && (
                    <div className="pt-2 border-t">
                      <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Categoria</p>
                      <p>{selectedUpload.category}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-4">
                  <Button asChild className="w-full">
                    <a
                      href={selectedUpload.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedUpload(null)} className="w-full">
                    Fechar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
