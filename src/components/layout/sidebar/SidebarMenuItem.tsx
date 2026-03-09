import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useSidebarContext } from "./SidebarContext";
import { usePlanFeaturesContext } from "@/contexts/PlanFeaturesContext";
import { UpgradePrompt } from "@/components/subscription/UpgradePrompt";
import { PlanBadge } from "@/components/subscription/PlanBadge";
import type { MenuItem } from "./SidebarMenuItems";

interface SidebarMenuItemProps {
  item: MenuItem;
  badge?: number;
  onNavigate?: () => void;
}

const featureToCheck: Record<string, 'hasSimulator' | 'hasAI' | 'hasCopilot' | 'hasPWADriver' | 'hasDedicatedSupport' | 'hasCTeModule' | 'hasCouplingModule'> = {
  simulator: 'hasSimulator',
  ai: 'hasAI',
  copilot: 'hasCopilot',
  pwaDriver: 'hasPWADriver',
  dedicatedSupport: 'hasDedicatedSupport',
  cteModule: 'hasCTeModule',
  couplingModule: 'hasCouplingModule',
};

const featureLabels: Record<string, string> = {
  simulator: 'Simulador de Frete',
  ai: 'Assistente IA',
  copilot: 'Copilot Flutuante',
  pwaDriver: 'App Motorista (PWA)',
  dedicatedSupport: 'Suporte Dedicado',
  cteModule: 'Emissão de CT-e',
  couplingModule: 'Gestão de Engates',
};

export function SidebarMenuItem({ item, badge, onNavigate }: SidebarMenuItemProps) {
  const { isCollapsed } = useSidebarContext();
  const planFeatures = usePlanFeaturesContext();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const Icon = item.icon;

  // Check if feature is locked
  const isLocked = item.requiredFeature 
    ? !planFeatures[featureToCheck[item.requiredFeature]]
    : false;

  const handleClick = (e: React.MouseEvent) => {
    if (isLocked) {
      e.preventDefault();
      setShowUpgradeDialog(true);
    } else {
      onNavigate?.();
    }
  };

  const content = (
    <Button
      type="button"
      variant="ghost"
      asChild={!isLocked}
      className={cn(
        "w-full h-10 transition-all duration-200",
        isCollapsed ? "justify-center px-2" : "justify-start px-3",
        isLocked && "opacity-70 cursor-pointer"
      )}
      onClick={isLocked ? handleClick : undefined}
    >
      {isLocked ? (
        <div className="flex items-center gap-3 w-full">
          <div className="relative">
            <Icon className="h-5 w-5 shrink-0" />
            <Lock className="h-3 w-3 absolute -bottom-1 -right-1 text-muted-foreground" />
          </div>
          {!isCollapsed && (
            <>
              <span className="flex-1 truncate text-muted-foreground">{item.label}</span>
              {item.requiredPlan && (
                <PlanBadge plan={item.requiredPlan as 'PRO' | 'ENTERPRISE' | 'CONCIERGE'} />
              )}
            </>
          )}
        </div>
      ) : (
        <NavLink
          to={item.href || "#"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 w-full",
              isActive && "bg-primary/10 text-primary hover:bg-primary/10"
            )
          }
        >
          <Icon className="h-5 w-5 shrink-0" />
          {!isCollapsed && (
            <>
              <span className="flex-1 truncate">{item.label}</span>
              {badge !== undefined && badge > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {badge}
                </Badge>
              )}
            </>
          )}
        </NavLink>
      )}
    </Button>
  );

  const tooltipContent = isLocked ? (
    <div className="flex items-center gap-2">
      <Lock className="h-3 w-3" />
      {item.label}
      {item.requiredPlan && (
        <PlanBadge plan={item.requiredPlan as 'PRO' | 'ENTERPRISE' | 'CONCIERGE'} />
      )}
    </div>
  ) : (
    <div className="flex items-center gap-2">
      {item.label}
      {badge !== undefined && badge > 0 && (
        <Badge variant="destructive">{badge}</Badge>
      )}
    </div>
  );

  return (
    <>
      {isCollapsed ? (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      ) : (
        content
      )}

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <UpgradePrompt
            featureName={item.requiredFeature ? featureLabels[item.requiredFeature] : item.label}
            requiredPlan={item.requiredPlan || 'Pro'}
            currentPlan={planFeatures.planName}
            onClose={() => setShowUpgradeDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
