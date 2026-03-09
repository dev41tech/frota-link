import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, MapPin, Package, Weight, DollarSign, FileText } from "lucide-react";

interface ParsedData {
  accessKey: string;
  nfeNumber: string;
  emitter: { name: string; cnpj: string; city: string; state: string };
  recipient: { name: string; document: string; city: string; state: string };
  totalValue: number;
  totalWeight: number;
  cargoDescription: string;
}

interface EstimationDetails {
  distance_km: number;
  avg_consumption_kml: number;
  avg_diesel_price: number;
  fuel_cost: number;
  estimated_toll: number;
  margin_applied: number;
}

interface FreightQuoteDisplayProps {
  parsedData: ParsedData;
  freightValue: number;
  hasRate: boolean;
  onApprove: () => void;
  onCancel: () => void;
  isApproving: boolean;
  estimationSource?: string;
  estimationDetails?: EstimationDetails;
  weightSource?: "xml" | "manual";
}

export function FreightQuoteDisplay({
  parsedData,
  freightValue,
  hasRate,
  onApprove,
  onCancel,
  isApproving,
  estimationSource,
  estimationDetails,
  weightSource,
}: FreightQuoteDisplayProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatWeight = (value: number) =>
    new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(value) + " kg";

  const isEstimated = estimationSource === "simulator";

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Cotação de Frete</h2>
        <p className="text-sm text-muted-foreground">Confira os dados abaixo e aprove o frete</p>
      </div>

      {/* Valor do Frete em Destaque */}
      <Card className={isEstimated ? "border-amber-500/50 bg-amber-50/50" : "border-primary/50 bg-primary/5"}>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-muted-foreground mb-1">
            {isEstimated ? "Valor Estimado do Frete" : "Valor do Frete"}
          </p>
          <p className={`text-4xl font-bold ${isEstimated ? "text-amber-700" : "text-primary"}`}>
            {formatCurrency(freightValue)}
          </p>
          {isEstimated && (
            <div className="mt-3 space-y-1">
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                Valor estimado via simulador
              </Badge>
              <p className="text-xs text-amber-600">
                Estimativa baseada na distância e custos operacionais. O valor final pode ser ajustado pelo operador.
              </p>
            </div>
          )}
          {!hasRate && !isEstimated && (
            <p className="text-xs text-amber-600 mt-2">
              ⚠ Sem tabela de frete cadastrada. Valor pode ser ajustado pelo operador.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dados da NF-e */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Dados da NF-e
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground">Número</p>
              <p className="font-medium">{parsedData.nfeNumber}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Chave de Acesso</p>
              <p className="font-mono text-xs break-all">{parsedData.accessKey}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rota */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Rota
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Remetente</p>
              <p className="font-medium">{parsedData.emitter.name}</p>
              <p className="text-muted-foreground">{parsedData.emitter.city}/{parsedData.emitter.state}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Destinatário</p>
              <p className="font-medium">{parsedData.recipient.name}</p>
              <p className="text-muted-foreground">{parsedData.recipient.city}/{parsedData.recipient.state}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Carga */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" /> Carga
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground flex items-center gap-1"><Weight className="h-3 w-3" /> Peso</p>
              <p className="font-medium">
                {formatWeight(parsedData.totalWeight)}
                {weightSource === "manual" && (
                  <Badge variant="outline" className="ml-2 text-xs">informado manualmente</Badge>
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Valor</p>
              <p className="font-medium">{formatCurrency(parsedData.totalValue)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Descrição</p>
              <p className="font-medium">{parsedData.cargoDescription}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isApproving}>
          <XCircle className="h-4 w-4 mr-2" /> Cancelar
        </Button>
        <Button className="flex-1" onClick={onApprove} disabled={isApproving}>
          <CheckCircle className="h-4 w-4 mr-2" />
          {isApproving ? "Aprovando..." : "Aprovar Frete"}
        </Button>
      </div>
    </div>
  );
}
