import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, AlertTriangle, TrendingUp, TrendingDown, Truck, Fuel, Wrench, DollarSign } from "lucide-react";
import { VehicleDREModal } from "./VehicleDREModal";
import { formatCurrency } from "@/lib/profitabilityCalculations";

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
  maintenanceCost: number;
  fuelCost: number;
  otherExpensesCost: number;
  fuelConsumption?: number | null;
  totalDistance?: number;
  totalLiters?: number;
}

interface VehicleProfitabilityDashboardProps {
  data: VehicleData[] | null;
  loading: boolean;
  startDate?: Date;
  endDate?: Date;
}

function VehicleHeroCard({ vehicle, type }: { vehicle: VehicleData | null; type: "mvp" | "attention" }) {
  const isMvp = type === "mvp";

  if (!vehicle) {
    return (
      <Card className={`${isMvp ? "bg-emerald-50/50 border-emerald-200" : "bg-red-50/50 border-red-200"}`}>
        <CardContent className="p-6 text-center text-muted-foreground">
          Nenhum veículo encontrado
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden ${isMvp ? "bg-emerald-50/50 border-emerald-200" : "bg-red-50/50 border-red-200"}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            {isMvp ? (
              <div className="p-2 rounded-full bg-emerald-100">
                <Award className="h-5 w-5 text-emerald-600" />
              </div>
            ) : (
              <div className="p-2 rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            )}
            <div>
              <h3 className={`font-semibold ${isMvp ? "text-emerald-800" : "text-red-800"}`}>
                {isMvp ? "Veículo MVP" : "Ponto de Atenção"}
              </h3>
              <p className={`text-xs ${isMvp ? "text-emerald-600" : "text-red-600"}`}>
                {isMvp ? "Mais Lucrativo" : "Menos Lucrativo"}
              </p>
            </div>
          </div>
          {isMvp ? (
            <TrendingUp className="h-8 w-8 text-emerald-300" />
          ) : (
            <TrendingDown className="h-8 w-8 text-red-300" />
          )}
        </div>

        <div className="space-y-2">
          <p className="font-medium text-foreground text-lg">{vehicle.plate}</p>
          <p className="text-sm text-muted-foreground">{vehicle.model || "—"}</p>
          <p className="text-sm text-muted-foreground">{vehicle.journeyCount} jornada(s) no período</p>
          <div className={`text-2xl font-bold ${isMvp ? "text-emerald-600" : "text-red-600"}`}>
            {vehicle.totalProfit >= 0 ? "Lucro: " : "Prejuízo: "}
            {formatCurrency(Math.abs(vehicle.totalProfit))}
          </div>
          <div
            className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${
              isMvp ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
            }`}
          >
            Margem: {vehicle.margin.toFixed(1)}%
          </div>

          {!isMvp && vehicle.totalExpenses > 0 && (
            <div className="mt-3 pt-3 border-t border-red-200">
              {(() => {
                const maxCost = Math.max(vehicle.fuelCost, vehicle.maintenanceCost, vehicle.otherExpensesCost);
                let offender = "Outras Despesas";
                if (maxCost === vehicle.fuelCost) offender = "Combustível";
                else if (maxCost === vehicle.maintenanceCost) offender = "Manutenção";
                return (
                  <span className="text-xs text-red-700 font-medium">
                    🎯 Maior custo: {offender} ({formatCurrency(maxCost)})
                  </span>
                );
              })()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CostBreakdownBar({ vehicle }: { vehicle: VehicleData }) {
  const total = vehicle.totalExpenses;
  if (total === 0) return null;

  const segments = [
    { key: "fuel", value: vehicle.fuelCost, color: "bg-blue-500", label: "Combustível", icon: Fuel },
    { key: "maintenance", value: vehicle.maintenanceCost, color: "bg-orange-500", label: "Manutenção", icon: Wrench },
    { key: "other", value: vehicle.otherExpensesCost, color: "bg-gray-400", label: "Outros", icon: DollarSign },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-1.5">
      <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={`${seg.color}`}
            style={{ width: `${(seg.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {segments.map((seg) => {
          const Icon = seg.icon;
          return (
            <span key={seg.key} className="flex items-center gap-1 text-muted-foreground">
              <Icon className="h-3 w-3" />
              {seg.label} {((seg.value / total) * 100).toFixed(0)}%
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function VehicleProfitabilityDashboard({ data, loading, startDate, endDate }: VehicleProfitabilityDashboardProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleData | null>(null);
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Truck className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">Nenhum veículo com dados no período</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Cadastre receitas e despesas vinculadas a veículos para ver a análise.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...data].sort((a, b) => b.margin - a.margin);
  const bestVehicle = sorted[0];
  const worstVehicle = sorted.length > 1 ? sorted[sorted.length - 1] : null;

  return (
    <div className="space-y-6">
      {/* Hero Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <VehicleHeroCard vehicle={bestVehicle} type="mvp" />
        <VehicleHeroCard
          vehicle={worstVehicle && worstVehicle.vehicleId !== bestVehicle.vehicleId ? worstVehicle : null}
          type="attention"
        />
      </div>

      {/* Vehicle List */}
      <Card className="border shadow-sm">
        <CardHeader className="bg-gray-50/50 border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Ranking de Veículos</CardTitle>
              <CardDescription>Ordenado por margem de lucro</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {data.length} veículo(s)
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-3">#</th>
                  <th className="px-6 py-3">Veículo</th>
                  <th className="px-6 py-3 text-right">Jornadas</th>
                  <th className="px-6 py-3 text-right">Receita</th>
                  <th className="px-6 py-3 text-right">Despesas</th>
                  <th className="px-6 py-3 text-right">Lucro</th>
                  <th className="px-6 py-3 text-center">Margem</th>
                  <th className="px-6 py-3 text-center">Média km/l</th>
                  <th className="px-6 py-3">Composição de Custos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((vehicle, index) => (
                  <tr key={vehicle.vehicleId} className="hover:bg-gray-50/80 transition-colors cursor-pointer" onClick={() => setSelectedVehicle(vehicle)}>
                    <td className="px-6 py-3">
                      {index === 0 ? (
                        <Award className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <span className="text-muted-foreground">{index + 1}</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{vehicle.plate}</p>
                        {vehicle.model && (
                          <p className="text-xs text-muted-foreground">{vehicle.model}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right text-gray-500">{vehicle.journeyCount}</td>
                    <td className="px-6 py-3 text-right text-gray-900">{formatCurrency(vehicle.totalRevenue)}</td>
                    <td className="px-6 py-3 text-right text-rose-600">{formatCurrency(vehicle.totalExpenses)}</td>
                    <td
                      className={`px-6 py-3 text-right font-bold ${
                        vehicle.totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {formatCurrency(vehicle.totalProfit)}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                          vehicle.margin >= 20
                            ? "bg-emerald-100 text-emerald-800"
                            : vehicle.margin >= 0
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {vehicle.margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      {vehicle.fuelConsumption != null ? (
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                            vehicle.fuelConsumption >= 3.5
                              ? "bg-emerald-100 text-emerald-800"
                              : vehicle.fuelConsumption >= 2.5
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {vehicle.fuelConsumption.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 min-w-[180px]">
                      <CostBreakdownBar vehicle={vehicle} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <VehicleDREModal
        vehicle={selectedVehicle}
        open={!!selectedVehicle}
        onOpenChange={(open) => { if (!open) setSelectedVehicle(null); }}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}
