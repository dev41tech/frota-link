import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useSidebarContext } from "./SidebarContext";
import { SidebarMenuItem } from "./SidebarMenuItem";
import type { MenuGroup } from "./SidebarMenuItems";

interface SidebarMenuGroupProps {
  group: MenuGroup;
  badgeMap?: Record<string, number>;
  onNavigate?: () => void;
}

export function SidebarMenuGroup({ group, badgeMap = {}, onNavigate }: SidebarMenuGroupProps) {
  const { isCollapsed } = useSidebarContext();
  const location = useLocation();
  const Icon = group.icon;

  // Check if any child is active
  const isGroupActive = group.items.some(
    (item) => item.href && location.pathname === item.href
  );

  const [isOpen, setIsOpen] = useState(isGroupActive);

  // Keep group open when route changes to one of its children
  useEffect(() => {
    if (isGroupActive) {
      setIsOpen(true);
    }
  }, [isGroupActive]);

  // Collapsed mode: show just icon with tooltip menu
  if (isCollapsed) {
    return (
      <HoverCard openDelay={0} closeDelay={150}>
        <HoverCardTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "w-full h-10 justify-center px-2",
              isGroupActive && "bg-primary/10 text-primary"
            )}
          >
            <Icon className="h-5 w-5" />
          </Button>
        </HoverCardTrigger>
        <HoverCardContent side="right" align="start" sideOffset={8} className="p-0 w-auto min-w-[180px]">
          <div className="py-2">
            <div className="px-3 py-1.5 text-sm font-semibold text-muted-foreground">
              {group.label}
            </div>
            {group.items.map((item) => (
              <SidebarMenuItem
                key={item.id}
                item={{ ...item, icon: item.icon }}
                badge={badgeMap[item.id]}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  // Expanded mode: collapsible group
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "w-full justify-between h-10 px-3",
            isGroupActive && "bg-primary/10 text-primary"
          )}
        >
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5" />
            <span>{group.label}</span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 space-y-0.5 mt-0.5">
        {group.items.map((item) => (
          <SidebarMenuItem
            key={item.id}
            item={item}
            badge={badgeMap[item.id]}
            onNavigate={onNavigate}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
