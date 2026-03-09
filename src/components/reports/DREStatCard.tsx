import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle, LucideIcon } from "lucide-react";

interface DREStatCardProps {
  title: string;
  value: string;
  subValue?: string;
  variation?: number;
  type?: "success" | "danger" | "neutral" | "default";
  icon?: LucideIcon;
  tooltip?: string;
  onClick?: () => void;
}

export function DREStatCard({
  title,
  value,
  subValue,
  variation,
  type = "neutral",
  icon: Icon,
  tooltip,
  onClick,
}: DREStatCardProps) {
  const getColor = () => {
    if (type === "success") return "text-emerald-600 dark:text-emerald-400";
    if (type === "danger") return "text-rose-600 dark:text-rose-400";
    return "text-foreground";
  };

  const getVariationColor = (v: number) => {
    if (v > 0) return "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50";
    if (v < 0) return "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/50";
    return "text-muted-foreground";
  };

  return (
    <Card
      className={`transition-all hover:shadow-md ${onClick ? "cursor-pointer hover:border-primary/50" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {tooltip && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px] text-xs">
                  <p>{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${getColor()}`}>{value}</div>
        {(variation !== undefined || subValue) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            {variation !== undefined && (
              <Badge variant="outline" className={getVariationColor(variation)}>
                {variation >= 0 ? "+" : ""}
                {variation.toFixed(1)}%
              </Badge>
            )}
            {subValue && <span>{subValue}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
