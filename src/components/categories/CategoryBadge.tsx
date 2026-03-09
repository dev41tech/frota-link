import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import * as LucideIcons from "lucide-react";

interface CategoryBadgeProps {
  name: string;
  icon: string;
  color: string;
  classification?: 'direct' | 'indirect';
  showClassification?: boolean;
}

export const CategoryBadge = ({ 
  name, 
  icon, 
  color, 
  classification,
  showClassification = false 
}: CategoryBadgeProps) => {
  const IconComponent = (LucideIcons as any)[icon] || LucideIcons.Package;
  
  const classificationLabel = classification === 'direct' ? 'Direta' : classification === 'indirect' ? 'Indireta' : null;
  const classificationTooltip = classification === 'direct' 
    ? 'Despesa vinculada a viagens específicas' 
    : classification === 'indirect' 
    ? 'Despesa administrativa/fixa' 
    : null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/50" style={{ backgroundColor: `${color}15` }}>
        <IconComponent className="h-4 w-4" style={{ color }} />
        <span className="text-sm font-medium">{name}</span>
      </div>
      {showClassification && classificationLabel && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant={classification === 'direct' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {classificationLabel}
              </Badge>
            </TooltipTrigger>
            {classificationTooltip && (
              <TooltipContent>
                <p>{classificationTooltip}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};
