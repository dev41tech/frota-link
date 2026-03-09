import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Info } from "lucide-react";
import { DREData } from "@/lib/dreCalculations";

interface DataQualityIssue {
  type: "warning" | "info";
  message: string;
}

interface DREDataQualityAlertProps {
  dreData: DREData;
  unlinkedFuelCount?: number;
  journeysWithoutDistance?: number;
}

export function DREDataQualityAlert({
  dreData,
  unlinkedFuelCount = 0,
  journeysWithoutDistance = 0,
}: DREDataQualityAlertProps) {
  const issues: DataQualityIssue[] = [];

  // Check for journeys without distance
  if (journeysWithoutDistance > 0) {
    issues.push({
      type: "warning",
      message: `${journeysWithoutDistance} jornada(s) sem registro de distância. Os indicadores por km podem estar incorretos.`,
    });
  }

  // Check for zero distance but has journeys
  if (dreData.journeys.count > 0 && dreData.journeys.totalDistance === 0) {
    issues.push({
      type: "warning",
      message: "Nenhuma jornada possui distância registrada. Indicadores de km/L e R$/km não podem ser calculados.",
    });
  }

  // Check for unlinked fuel expenses
  if (unlinkedFuelCount > 0) {
    issues.push({
      type: "info",
      message: `${unlinkedFuelCount} abastecimento(s) não vinculado(s) a jornadas foram incluídos no período.`,
    });
  }

  // Check for zero consumption but has fuel
  if (
    dreData.directExpenses.fuel.liters > 0 &&
    dreData.indicators.operational.avgConsumption === 0
  ) {
    issues.push({
      type: "warning",
      message: "Consumo médio zerado. Verifique se os abastecimentos possuem KM rodados registrado.",
    });
  }

  if (issues.length === 0) return null;

  const hasWarnings = issues.some((i) => i.type === "warning");

  return (
    <Alert variant={hasWarnings ? "destructive" : "default"} className="bg-background">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="text-sm">Qualidade dos Dados</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-1 text-sm">
          {issues.map((issue, index) => (
            <li key={index} className="flex items-start gap-2">
              {issue.type === "warning" ? (
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
              ) : (
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
              )}
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
