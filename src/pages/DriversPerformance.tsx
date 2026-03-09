import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, Award, AlertTriangle, Users, Route, Fuel, DollarSign } from 'lucide-react';

interface DriverPerformance {
  id: string;
  name: string;
  totalJourneys: number;
  totalDistance: number;
  totalRevenue: number;
  totalFuelCost: number;
  averageConsumption: number;
  efficiency: number;
  completionRate: number;
  score: number;
  rank: number;
}

interface PerformanceMetric {
  driver: string;
  journeys: number;
  revenue: number;
  fuelCost: number;
  efficiency: number;
}

export default function DriversPerformance() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const [drivers, setDrivers] = useState<DriverPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30'); // days
  const [sortBy, setSortBy] = useState('score');

  useEffect(() => {
    if (user) {
      fetchPerformanceData();
    }
  }, [user, period]);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);

      if (!currentCompany?.id) {
        setLoading(false);
        return;
      }

      const periodDate = new Date();
      periodDate.setDate(periodDate.getDate() - parseInt(period));

      // Fetch drivers
      const { data: driversData } = await supabase
        .from('drivers')
        .select('id, name')
        .eq('company_id', currentCompany.id)
        .eq('status', 'active');

      if (!driversData) return;

      // Fetch performance data for each driver
      const performancePromises = driversData.map(async (driver) => {
        // Journeys - include start_km and end_km for distance fallback
        const { data: journeys } = await supabase
          .from('journeys')
          .select('id, distance, freight_value, status, start_km, end_km')
          .eq('company_id', currentCompany.id)
          .eq('driver_id', driver.id)
          .gte('start_date', periodDate.toISOString());

        // Fuel expenses - filter deleted records
        const journeyIds = journeys?.map(j => j.id) || [];
        let fuelExpenses: { total_amount: number; liters: number }[] = [];
        if (journeyIds.length > 0) {
          const { data: fuelData } = await supabase
            .from('fuel_expenses')
            .select('total_amount, liters')
            .eq('company_id', currentCompany.id)
            .in('journey_id', journeyIds)
            .is('deleted_at', null)
            .gte('date', periodDate.toISOString());
          fuelExpenses = fuelData || [];
        }

        const totalJourneys = journeys?.length || 0;
        const completedJourneys = journeys?.filter(j => j.status === 'completed').length || 0;
        // Distance with centralized priority: end_km - start_km > distance
        const totalDistance = journeys?.reduce((sum, j) => {
          if (j.end_km && j.start_km && j.end_km > j.start_km) return sum + (j.end_km - j.start_km);
          if (j.distance && j.distance > 0) return sum + j.distance;
          return sum;
        }, 0) || 0;
        const totalRevenue = journeys?.reduce((sum, j) => sum + (j.freight_value || 0), 0) || 0;
        const totalFuelCost = fuelExpenses?.reduce((sum, f) => sum + f.total_amount, 0) || 0;
        const totalLiters = fuelExpenses?.reduce((sum, f) => sum + f.liters, 0) || 0;
        
        // Apply MAX_REALISTIC filter (15 km/l)
        const rawConsumption = totalLiters > 0 && totalDistance > 0 ? totalDistance / totalLiters : 0;
        const averageConsumption = rawConsumption > 15 ? 0 : rawConsumption;
        const completionRate = totalJourneys > 0 ? (completedJourneys / totalJourneys) * 100 : 0;
        const efficiency = totalFuelCost > 0 && totalRevenue > 0 ? (totalRevenue / totalFuelCost) : 0;
        
        // Calculate performance score (0-100)
        let score = 0;
        score += Math.min(completionRate, 100) * 0.3; // 30% completion rate
        score += Math.min(efficiency * 10, 100) * 0.3; // 30% fuel efficiency
        score += Math.min(averageConsumption * 8, 100) * 0.2; // 20% consumption
        score += Math.min(totalJourneys * 5, 100) * 0.2; // 20% activity

        return {
          id: driver.id,
          name: driver.name,
          totalJourneys,
          totalDistance,
          totalRevenue,
          totalFuelCost,
          averageConsumption,
          efficiency,
          completionRate,
          score: Math.round(score),
          rank: 0 // Will be calculated after sorting
        };
      });

      const performanceData = await Promise.all(performancePromises);
      
      // Sort by score and assign ranks
      const sortedData = performanceData.sort((a, b) => b.score - a.score);
      const rankedData = sortedData.map((driver, index) => ({
        ...driver,
        rank: index + 1
      }));

      setDrivers(rankedData);
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSortedDrivers = () => {
    const sorted = [...drivers];
    
    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'journeys':
        return sorted.sort((a, b) => b.totalJourneys - a.totalJourneys);
      case 'revenue':
        return sorted.sort((a, b) => b.totalRevenue - a.totalRevenue);
      case 'efficiency':
        return sorted.sort((a, b) => b.efficiency - a.efficiency);
      case 'consumption':
        return sorted.sort((a, b) => b.averageConsumption - a.averageConsumption);
      case 'completion':
        return sorted.sort((a, b) => b.completionRate - a.completionRate);
      default: // score
        return sorted.sort((a, b) => b.score - a.score);
    }
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getPerformanceLabel = (score: number) => {
    if (score >= 80) return 'Excelente';
    if (score >= 60) return 'Bom';
    if (score >= 40) return 'Regular';
    return 'Baixo';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const chartData = drivers.slice(0, 10).map(driver => ({
    name: driver.name.split(' ')[0],
    score: driver.score,
    revenue: driver.totalRevenue,
    efficiency: driver.efficiency * 10 // Scale for better visualization
  }));

  const topPerformer = drivers[0];
  const averageScore = drivers.reduce((sum, d) => sum + d.score, 0) / drivers.length || 0;
  const totalRevenue = drivers.reduce((sum, d) => sum + d.totalRevenue, 0);
  const totalJourneys = drivers.reduce((sum, d) => sum + d.totalJourneys, 0);

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Award className="h-8 w-8 text-primary" />
            Performance dos Motoristas
          </h1>
          <p className="text-muted-foreground">Compare o desempenho e eficiência dos motoristas</p>
        </div>
        
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
              <SelectItem value="365">1 ano</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Performance</SelectItem>
              <SelectItem value="name">Nome</SelectItem>
              <SelectItem value="journeys">Jornadas</SelectItem>
              <SelectItem value="revenue">Receita</SelectItem>
              <SelectItem value="efficiency">Eficiência</SelectItem>
              <SelectItem value="consumption">Consumo</SelectItem>
              <SelectItem value="completion">Taxa Conclusão</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-sm">
              <Award className="h-4 w-4 text-gold" />
              <span>Melhor Desempenho</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{topPerformer?.name || 'N/A'}</p>
            <p className="text-sm text-muted-foreground">
              Score: {topPerformer?.score || 0}/100
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span>Score Médio</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{averageScore.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground">de 100 pontos</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-sm">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span>Receita Total</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
            <p className="text-sm text-muted-foreground">{period} dias</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-sm">
              <Route className="h-4 w-4 text-blue-600" />
              <span>Total Jornadas</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalJourneys}</p>
            <p className="text-sm text-muted-foreground">Todas as jornadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Ranking de Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === 'score') return [value, 'Score'];
                  if (name === 'revenue') return [formatCurrency(Number(value)), 'Receita'];
                  return [value, name];
                }}
              />
              <Bar dataKey="score" fill="#3b82f6" name="Score" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Detalhes de Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Jornadas</TableHead>
                <TableHead>Receita</TableHead>
                <TableHead>Eficiência</TableHead>
                <TableHead>Consumo</TableHead>
                <TableHead>Taxa Conclusão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getSortedDrivers().map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {driver.rank === 1 && <Award className="h-3 w-3 text-gold" />}
                      {driver.rank === 2 && <Award className="h-3 w-3 text-gray-400" />}
                      {driver.rank === 3 && <Award className="h-3 w-3 text-orange-400" />}
                      <span className="font-medium">#{driver.rank}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{driver.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPerformanceColor(driver.score)}>
                      {driver.score}/100 - {getPerformanceLabel(driver.score)}
                    </Badge>
                  </TableCell>
                  <TableCell>{driver.totalJourneys}</TableCell>
                  <TableCell>{formatCurrency(driver.totalRevenue)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {driver.efficiency > 3 ? (
                        <TrendingUp className="h-3 w-3 text-green-600" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-600" />
                      )}
                      <span>{driver.efficiency.toFixed(1)}x</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Fuel className="h-3 w-3 text-muted-foreground" />
                      <span>{driver.averageConsumption.toFixed(1)} km/L</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {driver.completionRate >= 90 ? (
                        <TrendingUp className="h-3 w-3 text-green-600" />
                      ) : driver.completionRate >= 70 ? (
                        <TrendingUp className="h-3 w-3 text-yellow-600" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 text-red-600" />
                      )}
                      <span>{driver.completionRate.toFixed(1)}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}