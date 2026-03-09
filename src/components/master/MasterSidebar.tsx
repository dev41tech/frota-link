import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  Building2,
  CreditCard,
  Users,
  FileText,
  Shield,
  Settings,
  AlertTriangle,
  DollarSign,
  LogOut,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: SidebarItem[];
}

const masterMenuItems: SidebarItem[] = [
  { 
    id: "dashboard", 
    label: "Dashboard", 
    icon: BarChart3, 
    href: "/home" 
  },
  { 
    id: "companies", 
    label: "Empresas", 
    icon: Building2,
    href: "/companies"
  },
  { 
    id: "billing", 
    label: "Faturamento", 
    icon: CreditCard,
    children: [
      { id: "billing-overview", label: "Cobranças", icon: DollarSign, href: "/billing" },
      { id: "billing-plans", label: "Planos", icon: CreditCard, href: "/billing/plans" },
    ]
  },
  { 
    id: "reports", 
    label: "Relatórios", 
    icon: FileText,
    href: "/reports/usage"
  },
  { 
    id: "team", 
    label: "Equipe & Acessos", 
    icon: Users, 
    href: "/team" 
  },
  { 
    id: "alerts", 
    label: "Alertas", 
    icon: AlertTriangle, 
    href: "/alerts" 
  },
  { 
    id: "settings", 
    label: "Configurações", 
    icon: Settings, 
    href: "/settings" 
  }
];

interface MasterSidebarProps {
  onLogout: () => void;
}

export default function MasterSidebar({ onLogout }: MasterSidebarProps) {
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  // Initialize open groups based on current route
  useEffect(() => {
    const activeGroups: string[] = [];
    masterMenuItems.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some(
          (child) => child.href && location.pathname.startsWith(child.href)
        );
        if (hasActiveChild) {
          activeGroups.push(item.id);
        }
      }
    });
    setOpenGroups(activeGroups);
  }, [location.pathname]);

  const handleGroupToggle = (groupId: string, open: boolean) => {
    setOpenGroups(prev => 
      open 
        ? [...new Set([...prev, groupId])]
        : prev.filter(id => id !== groupId)
    );
  };

  const isGroupActive = (item: SidebarItem) => {
    if (!item.children) return false;
    return item.children.some(
      (child) => child.href && location.pathname.startsWith(child.href)
    );
  };

  const renderMenuItem = (item: SidebarItem, level = 0) => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isGroupOpen = openGroups.includes(item.id);
    const groupActive = isGroupActive(item);

    if (hasChildren) {
      return (
        <Collapsible
          key={item.id}
          open={isGroupOpen}
          onOpenChange={(open) => handleGroupToggle(item.id, open)}
        >
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "w-full justify-start space-x-3 h-11",
                groupActive && "bg-primary/10 text-primary",
                level > 0 && "ml-4"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="flex-1 text-left">{item.label}</span>
              {isGroupOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1">
            {item.children?.map(child => renderMenuItem(child, level + 1))}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    if (item.href) {
      return (
        <Button
          key={item.id}
          variant="ghost"
          asChild
          className={cn(
            "w-full justify-start space-x-3 h-11",
            level > 0 && "text-sm ml-4"
          )}
        >
          <NavLink
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex items-center space-x-3",
                isActive && "bg-primary/10 text-primary hover:bg-primary/10"
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        </Button>
      );
    }

    return null;
  };

  return (
    <aside
      className="w-64 bg-card border-r border-border h-screen flex flex-col shadow-card"
      aria-label="Navegação Master"
    >
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="bg-primary p-2 rounded-lg shadow-primary">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Frota Link Master</h1>
            <p className="text-sm text-muted-foreground">Painel Administrativo</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {masterMenuItems.map((item) => renderMenuItem(item))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start space-x-3 h-11 text-muted-foreground hover:text-destructive"
          onClick={onLogout}
          title="Sair"
        >
          <LogOut className="h-5 w-5" />
          <span>Sair</span>
        </Button>
      </div>
    </aside>
  );
}
