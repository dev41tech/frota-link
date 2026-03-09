import { useCustomerProfitability } from "@/hooks/useCustomerProfitability";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, AlertTriangle, TrendingUp, MapPin, Clock, Users } from "lucide-react";
import { formatCurrency } from "@/lib/profitabilityCalculations";

interface CustomerProfitabilityDashboardProps {
  startDate?: Date;
  endDate?: Date;
}

export function CustomerProfitabilityDashboard({ startDate, endDate }: CustomerProfitabilityDashboardProps) {
  const { data, bestCustomer, worstCustomer, loading } = useCustomerProfitability(startDate, endDate);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Calculando análise de clientes...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">Nenhum cliente encontrado</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Para ver a análise de clientes, cadastre clientes e vincule-os às jornadas.
            Acesse o menu <strong>Clientes e Fornecedores</strong> para começar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de Destaque */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Melhor Cliente */}
        {bestCustomer && (
          <Card className="border-none shadow-md bg-gradient-to-br from-emerald-50 to-white">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-emerald-100">
                  <Award className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-lg text-emerald-700">Melhor Cliente</CardTitle>
                  <CardDescription>Maior margem de lucro</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{bestCustomer.customerName}</h3>
                {bestCustomer.customerDocument && (
                  <p className="text-sm text-muted-foreground">{bestCustomer.customerDocument}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Faturamento</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(bestCustomer.totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Margem</p>
                  <p className="text-lg font-bold text-emerald-600">{bestCustomer.margin.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Jornadas</p>
                  <p className="text-lg font-semibold">{bestCustomer.journeyCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ticket Médio</p>
                  <p className="text-lg font-semibold">{formatCurrency(bestCustomer.avgTicket)}</p>
                </div>
              </div>

              {bestCustomer.topRoutes.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Principais Rotas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {bestCustomer.topRoutes.map((route, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {route.origin} → {route.destination} ({route.count}x)
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Cliente de Atenção */}
        {worstCustomer && worstCustomer.customerId !== bestCustomer?.customerId && (
          <Card className="border-none shadow-md bg-gradient-to-br from-amber-50 to-white">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-amber-100">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-lg text-amber-700">Cliente de Atenção</CardTitle>
                  <CardDescription>Menor margem de lucro</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{worstCustomer.customerName}</h3>
                {worstCustomer.customerDocument && (
                  <p className="text-sm text-muted-foreground">{worstCustomer.customerDocument}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Faturamento</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(worstCustomer.totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Margem</p>
                  <p className={`text-lg font-bold ${worstCustomer.margin >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                    {worstCustomer.margin.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Jornadas</p>
                  <p className="text-lg font-semibold">{worstCustomer.journeyCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Custo/Km</p>
                  <p className="text-lg font-semibold">{formatCurrency(worstCustomer.avgCostPerKm)}</p>
                </div>
              </div>

              {worstCustomer.topRoutes.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Principais Rotas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {worstCustomer.topRoutes.map((route, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {route.origin} → {route.destination} ({route.count}x)
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabela de Todos os Clientes */}
      <Card className="border shadow-sm">
        <CardHeader className="bg-gray-50/50 border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Ranking de Clientes</CardTitle>
              <CardDescription>Ordenado por margem de lucro</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {data.length} cliente(s)
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-3">#</th>
                  <th className="px-6 py-3">Cliente</th>
                  <th className="px-6 py-3 text-right">Jornadas</th>
                  <th className="px-6 py-3 text-right">Receita</th>
                  <th className="px-6 py-3 text-right">Despesas</th>
                  <th className="px-6 py-3 text-right">Lucro</th>
                  <th className="px-6 py-3 text-center">Margem</th>
                  <th className="px-6 py-3">Principal Rota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((customer, index) => (
                  <tr key={customer.customerId} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-3">
                      {index === 0 ? (
                        <Award className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <span className="text-muted-foreground">{index + 1}</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{customer.customerName}</p>
                        {customer.customerDocument && (
                          <p className="text-xs text-muted-foreground">{customer.customerDocument}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right text-gray-500">{customer.journeyCount}</td>
                    <td className="px-6 py-3 text-right text-gray-900">{formatCurrency(customer.totalRevenue)}</td>
                    <td className="px-6 py-3 text-right text-rose-600">{formatCurrency(customer.totalExpenses)}</td>
                    <td className={`px-6 py-3 text-right font-bold ${customer.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(customer.profit)}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                          customer.margin >= 20
                            ? 'bg-emerald-100 text-emerald-800'
                            : customer.margin >= 0
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {customer.margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-muted-foreground">
                      {customer.topRoutes[0] ? (
                        `${customer.topRoutes[0].origin} → ${customer.topRoutes[0].destination}`
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
