import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight, HelpCircle } from "lucide-react";
import { ExtendedDREData } from "@/hooks/useCompleteDRE";
import { formatCurrency } from "@/lib/dreCalculations";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DREHorizontalAnalysisProps {
  currentPeriod: ExtendedDREData;
  previousPeriod: ExtendedDREData | null;
  loading?: boolean;
}

interface AnalysisRow {
  label: string;
  currentValue: number;
  previousValue: number;
  variationAbs: number;
  variationPercent: number;
  isPositiveGood: boolean;
  indent?: boolean;
  bold?: boolean;
  separator?: boolean;
}

export function DREHorizontalAnalysis({ currentPeriod, previousPeriod, loading }: DREHorizontalAnalysisProps) {
  const analysisData = useMemo(() => {
    if (!previousPeriod) return null;

    const calculateVariation = (current: number, previous: number) => {
      const abs = current - previous;
      const percent = previous !== 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
      return { abs, percent };
    };

    const rows: AnalysisRow[] = [
      // Receitas
      (() => {
        const { abs, percent } = calculateVariation(currentPeriod.revenue.total, previousPeriod.revenue.total);
        return {
          label: "Receita Bruta",
          currentValue: currentPeriod.revenue.total,
          previousValue: previousPeriod.revenue.total,
          variationAbs: abs,
          variationPercent: percent,
          isPositiveGood: true,
          bold: true,
        };
      })(),

      // Categorias de receita
      ...currentPeriod.revenue.categories.map((cat: any) => {
        const prevCat = previousPeriod.revenue.categories.find((c: any) => c.name === cat.name);
        const prevValue = prevCat?.amount || 0;
        const { abs, percent } = calculateVariation(cat.amount, prevValue);
        return {
          label: cat.name,
          currentValue: cat.amount,
          previousValue: prevValue,
          variationAbs: abs,
          variationPercent: percent,
          isPositiveGood: true,
          indent: true,
        };
      }),

      // Separador
      { label: "", currentValue: 0, previousValue: 0, variationAbs: 0, variationPercent: 0, isPositiveGood: true, separator: true },

      // Custos Diretos
      (() => {
        const { abs, percent } = calculateVariation(currentPeriod.directExpenses.total, previousPeriod.directExpenses.total);
        return {
          label: "(-) Custos Diretos",
          currentValue: currentPeriod.directExpenses.total,
          previousValue: previousPeriod.directExpenses.total,
          variationAbs: abs,
          variationPercent: percent,
          isPositiveGood: false, // Menor é melhor para custos
          bold: true,
        };
      })(),

      // Combustível
      (() => {
        const { abs, percent } = calculateVariation(
          currentPeriod.directExpenses.fuel.total,
          previousPeriod.directExpenses.fuel.total
        );
        return {
          label: "Combustível",
          currentValue: currentPeriod.directExpenses.fuel.total,
          previousValue: previousPeriod.directExpenses.fuel.total,
          variationAbs: abs,
          variationPercent: percent,
          isPositiveGood: false,
          indent: true,
        };
      })(),

      // Outras categorias diretas
      ...currentPeriod.directExpenses.categories.map((cat: any) => {
        const prevCat = previousPeriod.directExpenses.categories.find((c: any) => c.name === cat.name);
        const prevValue = prevCat?.amount || 0;
        const { abs, percent } = calculateVariation(cat.amount, prevValue);
        return {
          label: cat.name,
          currentValue: cat.amount,
          previousValue: prevValue,
          variationAbs: abs,
          variationPercent: percent,
          isPositiveGood: false,
          indent: true,
        };
      }),

      // Margem Bruta
      (() => {
        const currentGross = currentPeriod.revenue.total - currentPeriod.directExpenses.total;
        const previousGross = previousPeriod.revenue.total - previousPeriod.directExpenses.total;
        const { abs, percent } = calculateVariation(currentGross, previousGross);
        return {
          label: "(=) Margem Bruta",
          currentValue: currentGross,
          previousValue: previousGross,
          variationAbs: abs,
          variationPercent: percent,
          isPositiveGood: true,
          bold: true,
        };
      })(),

      // Separador
      { label: "", currentValue: 0, previousValue: 0, variationAbs: 0, variationPercent: 0, isPositiveGood: true, separator: true },

      // Custos Indiretos
      (() => {
        const { abs, percent } = calculateVariation(
          currentPeriod.indirectExpenses.total,
          previousPeriod.indirectExpenses.total
        );
        return {
          label: "(-) Custos Indiretos",
          currentValue: currentPeriod.indirectExpenses.total,
          previousValue: previousPeriod.indirectExpenses.total,
          variationAbs: abs,
          variationPercent: percent,
          isPositiveGood: false,
          bold: true,
        };
      })(),

      // Categorias indiretas
      ...currentPeriod.indirectExpenses.categories.map((cat: any) => {
        const prevCat = previousPeriod.indirectExpenses.categories.find((c: any) => c.name === cat.name);
        const prevValue = prevCat?.amount || 0;
        const { abs, percent } = calculateVariation(cat.amount, prevValue);
        return {
          label: cat.name,
          currentValue: cat.amount,
          previousValue: prevValue,
          variationAbs: abs,
          variationPercent: percent,
          isPositiveGood: false,
          indent: true,
        };
      }),

      // Separador
      { label: "", currentValue: 0, previousValue: 0, variationAbs: 0, variationPercent: 0, isPositiveGood: true, separator: true },

      // Resultado Final
      (() => {
        const { abs, percent } = calculateVariation(currentPeriod.result.profit, previousPeriod.result.profit);
        return {
          label: "(=) Lucro/Prejuízo Líquido",
          currentValue: currentPeriod.result.profit,
          previousValue: previousPeriod.result.profit,
          variationAbs: abs,
          variationPercent: percent,
          isPositiveGood: true,
          bold: true,
        };
      })(),

      // Margem Líquida
      (() => {
        const { abs, percent } = calculateVariation(currentPeriod.result.margin, previousPeriod.result.margin);
        return {
          label: "Margem Líquida (%)",
          currentValue: currentPeriod.result.margin,
          previousValue: previousPeriod.result.margin,
          variationAbs: abs,
          variationPercent: percent,
          isPositiveGood: true,
          bold: true,
        };
      })(),
    ];

    return rows;
  }, [currentPeriod, previousPeriod]);

  const getVariationColor = (value: number, isPositiveGood: boolean) => {
    if (value === 0) return "text-muted-foreground";
    const isGood = isPositiveGood ? value > 0 : value < 0;
    return isGood ? "text-green-600" : "text-red-600";
  };

  const getVariationIcon = (value: number) => {
    if (Math.abs(value) < 0.01) return <Minus className="h-3 w-3" />;
    return value > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />;
  };

  if (!previousPeriod) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Análise Horizontal
          </CardTitle>
          <CardDescription>
            Ative o modo de comparação para visualizar a análise horizontal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <HelpCircle className="h-8 w-8 mr-3 opacity-50" />
            <span>Selecione um período de comparação para ver as variações</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentLabel = format(currentPeriod.period.start, "MMM/yy", { locale: ptBR }) + " - " + format(currentPeriod.period.end, "MMM/yy", { locale: ptBR });
  const previousLabel = format(previousPeriod.period.start, "MMM/yy", { locale: ptBR }) + " - " + format(previousPeriod.period.end, "MMM/yy", { locale: ptBR });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Análise Horizontal
        </CardTitle>
        <CardDescription>
          Comparativo entre períodos: {currentLabel} vs {previousLabel}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Descrição</TableHead>
                <TableHead className="text-right">Período Atual</TableHead>
                <TableHead className="text-right">Período Anterior</TableHead>
                <TableHead className="text-right">Variação (R$)</TableHead>
                <TableHead className="text-right">Variação (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysisData?.map((row, idx) => {
                if (row.separator) {
                  return <TableRow key={idx} className="h-2 bg-muted/30"><TableCell colSpan={5}></TableCell></TableRow>;
                }

                const isMarginRow = row.label.includes("Margem") && row.label.includes("%");

                return (
                  <TableRow key={idx} className={row.bold ? "font-semibold bg-muted/20" : ""}>
                    <TableCell className={row.indent ? "pl-8" : ""}>
                      {row.label}
                    </TableCell>
                    <TableCell className="text-right">
                      {isMarginRow ? `${row.currentValue.toFixed(2)}%` : formatCurrency(row.currentValue)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {isMarginRow ? `${row.previousValue.toFixed(2)}%` : formatCurrency(row.previousValue)}
                    </TableCell>
                    <TableCell className={`text-right ${getVariationColor(row.variationAbs, row.isPositiveGood)}`}>
                      <div className="flex items-center justify-end gap-1">
                        {getVariationIcon(row.variationAbs)}
                        {isMarginRow ? `${row.variationAbs >= 0 ? "+" : ""}${row.variationAbs.toFixed(2)} p.p.` : formatCurrency(Math.abs(row.variationAbs))}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right ${getVariationColor(row.variationPercent, row.isPositiveGood)}`}>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge 
                            variant="outline" 
                            className={`${row.variationPercent > 0 
                              ? (row.isPositiveGood ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")
                              : row.variationPercent < 0
                              ? (row.isPositiveGood ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200")
                              : "bg-gray-50 text-gray-600 border-gray-200"
                            }`}
                          >
                            {row.variationPercent >= 0 ? "+" : ""}{row.variationPercent.toFixed(1)}%
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {row.variationPercent > 0 ? "Aumento" : row.variationPercent < 0 ? "Redução" : "Sem variação"} de {Math.abs(row.variationPercent).toFixed(1)}%
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
