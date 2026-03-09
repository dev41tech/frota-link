import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { formatCurrency } from '@/lib/profitabilityCalculations';

interface VehicleData {
  vehicleId: string;
  plate: string;
  model: string;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  margin: number;
  journeyCount: number;
  avgProfitPerJourney: number;
}

interface DriverData {
  driverId: string;
  name: string;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  margin: number;
  journeyCount: number;
  completionRate: number;
  avgProfitPerJourney: number;
}

interface ProfitabilityChartsProps {
  vehicleData: VehicleData[];
  driverData: DriverData[];
}

export function ProfitabilityCharts({ vehicleData, driverData }: ProfitabilityChartsProps) {
  const topVehicles = [...vehicleData]
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 10)
    .map(v => ({
      name: v.plate,
      margin: Number(v.margin.toFixed(1)),
      profit: v.totalProfit
    }));

  const topDrivers = [...driverData]
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 10)
    .map(d => ({
      name: d.name,
      margin: Number(d.margin.toFixed(1)),
      profit: d.totalProfit,
      completionRate: Number(d.completionRate.toFixed(0))
    }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Ranking de Veículos por Margem */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Veículos por Margem</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topVehicles} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={80} />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === 'margin') return `${value}%`;
                  if (name === 'profit') return formatCurrency(Number(value));
                  return value;
                }}
              />
              <Legend />
              <Bar dataKey="margin" fill="hsl(var(--chart-1))" name="Margem (%)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Ranking de Motoristas por Margem */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Motoristas por Margem</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topDrivers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === 'margin') return `${value}%`;
                  if (name === 'completionRate') return `${value}%`;
                  if (name === 'profit') return formatCurrency(Number(value));
                  return value;
                }}
              />
              <Legend />
              <Bar dataKey="margin" fill="hsl(var(--chart-2))" name="Margem (%)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Lucratividade por Veículo */}
      <Card>
        <CardHeader>
          <CardTitle>Lucro por Veículo</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topVehicles}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Bar dataKey="profit" fill="hsl(var(--chart-3))" name="Lucro" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Taxa de Conclusão de Motoristas */}
      <Card>
        <CardHeader>
          <CardTitle>Taxa de Conclusão - Motoristas</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topDrivers}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
              <Bar dataKey="completionRate" fill="hsl(var(--chart-4))" name="% Conclusão" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
