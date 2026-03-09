import { Truck, LogOut, Shield, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useClosureRequests } from "@/hooks/useClosureRequests";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useSidebarContext } from "./SidebarContext";
import { SidebarMenuItem } from "./SidebarMenuItem";
import { SidebarMenuGroup } from "./SidebarMenuGroup";
import { dashboardItem, menuGroups } from "./SidebarMenuItems";

interface SidebarContentProps {
  companyName: string;
  onLogout: () => void;
  onNavigate?: () => void;
}

export function SidebarContent({ companyName, onLogout, onNavigate }: SidebarContentProps) {
  const { isCollapsed, toggleCollapsed } = useSidebarContext();
  const { count: closureRequestsCount } = useClosureRequests();
  const { totalUnread: unreadMessagesCount } = useUnreadMessages();
  const impersonationData = localStorage.getItem("impersonation_data");
  const isImpersonating = !!impersonationData;

  const badgeMap: Record<string, number> = {
    journeys: closureRequestsCount,
    "driver-messages": unreadMessagesCount,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn(
        "p-4 border-b border-border flex items-center gap-3",
        isCollapsed && "justify-center p-3"
      )}>
        <div className="bg-primary p-2 rounded-lg shadow-primary shrink-0">
          <Truck className="h-5 w-5 text-primary-foreground" />
        </div>
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base truncate">Frota Link</h1>
            <p className="text-xs text-muted-foreground truncate">{companyName}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-1">
          {/* Master Panel Button */}
          {isImpersonating && (
            <div className="mb-3">
              {isCollapsed ? (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-10 justify-center px-2 border-primary text-primary"
                      onClick={() => (window.location.href = "/master")}
                    >
                      <Shield className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Painel Master</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-3 h-10 border-primary text-primary"
                  onClick={() => (window.location.href = "/master")}
                >
                  <Shield className="h-5 w-5" />
                  <span>Painel Master</span>
                </Button>
              )}
            </div>
          )}

          {/* Dashboard (direct item) */}
          <SidebarMenuItem item={dashboardItem} onNavigate={onNavigate} />

          {/* Menu Groups */}
          {menuGroups.map((group) => (
            <SidebarMenuGroup
              key={group.id}
              group={group}
              badgeMap={badgeMap}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-2 border-t border-border space-y-1">
        {/* Collapse Toggle - Desktop only */}
        <div className="hidden md:block">
          {isCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-10 justify-center px-2 text-muted-foreground"
                  onClick={toggleCollapsed}
                >
                  <PanelLeft className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expandir menu</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start gap-3 h-10 text-muted-foreground"
              onClick={toggleCollapsed}
            >
              <PanelLeftClose className="h-5 w-5" />
              <span>Recolher menu</span>
            </Button>
          )}
        </div>

        {/* Logout */}
        {isCollapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full h-10 justify-center px-2 text-muted-foreground hover:text-destructive"
                onClick={onLogout}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sair</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start gap-3 h-10 text-muted-foreground hover:text-destructive"
            onClick={onLogout}
          >
            <LogOut className="h-5 w-5" />
            <span>Sair</span>
          </Button>
        )}
      </div>
    </div>
  );
}
