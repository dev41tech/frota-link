import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

export default function StatsCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  variant = "default",
  className
}: StatsCardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "bg-success-light text-success";
      case "down":
        return "bg-danger-light text-danger";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return "border-success/20 bg-gradient-to-br from-success-light to-background";
      case "warning":
        return "border-warning/20 bg-gradient-to-br from-warning-light to-background";
      case "danger":
        return "border-danger/20 bg-gradient-to-br from-danger-light to-background";
      default:
        return "border-border";
    }
  };

  return (
    <Card className={cn("shadow-card hover:shadow-elevated transition-all duration-200", getVariantStyles(), className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && (
          <div className="text-muted-foreground">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="text-2xl font-bold">{value}</div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && trendValue && (
            <Badge variant="secondary" className={cn("text-xs", getTrendColor())}>
              {trendValue}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}