import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, AlertTriangle, Info, CheckCircle } from "lucide-react";

interface AlertCardProps {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  onResolve?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

export function AlertCard({
  id,
  type,
  severity,
  title,
  description,
  status,
  createdAt,
  onResolve,
  onDismiss,
}: AlertCardProps) {
  const getIcon = () => {
    switch (severity) {
      case "high":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case "medium":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "low":
        return <Info className="h-5 w-5 text-blue-600" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getSeverityBadge = () => {
    const variants: Record<string, { label: string; variant: any }> = {
      high: { label: "Crítico", variant: "destructive" },
      medium: { label: "Médio", variant: "secondary" },
      low: { label: "Baixo", variant: "outline" },
    };

    const config = variants[severity] || variants.low;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeBadge = () => {
    const labels: Record<string, string> = {
      billing: "Faturamento",
      usage: "Uso",
      health: "Saúde",
      system: "Sistema",
    };

    return <Badge variant="outline">{labels[type] || type}</Badge>;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("pt-BR");
  };

  return (
    <Card className={status === "resolved" ? "opacity-60" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">{getIcon()}</div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{title}</h3>
              {getSeverityBadge()}
              {getTypeBadge()}
              {status === "resolved" && (
                <Badge variant="outline" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Resolvido
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
            <p className="text-xs text-muted-foreground">{formatDate(createdAt)}</p>
            {status === "active" && (
              <div className="flex gap-2 pt-2">
                {onResolve && (
                  <Button size="sm" onClick={() => onResolve(id)}>
                    Resolver
                  </Button>
                )}
                {onDismiss && (
                  <Button size="sm" variant="outline" onClick={() => onDismiss(id)}>
                    Dispensar
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
