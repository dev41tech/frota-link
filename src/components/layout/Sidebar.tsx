import { useState, type ElementType, useEffect } from "react";
import {
  Truck,
  Route,
  CreditCard,
  FileText,
  Calculator,
  Users,
  Settings,
  LogOut,
  BarChart3,
  Fuel,
  MessageCircle,
  Award,
  UserPlus,
  Building2,
  Shield,
  TrendingUp,
  DollarSign,
  FileImage,
  ChevronDown,
  FileSpreadsheet,
  Wallet,
  PiggyBank,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useClosureRequests } from "@/hooks/useClosureRequests";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { api } from "@/lib/apiClient";

type IconType = ElementType;

interface SidebarItem {
  id: string;
  label: string;
  icon: IconType;
  href?: string;
  children?: SidebarItem[];
}

const sidebarItems: SidebarItem[] = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "journeys", label: "Jornadas", icon: Route },
  { id: "vehicles", label: "Veículos", icon: Truck },
  { id: "drivers", label: "Motoristas", icon: UserPlus },
  { id: "fuel", label: "Combustível", icon: Fuel },
  { id: "driver-uploads", label: "Comprovantes", icon: FileImage },
  { id: "cte", label: "CT-e", icon: FileText },
  { id: "accounts", label: "Contas", icon: CreditCard },
  { id: "accounts-payable", label: "Contas a Pagar", icon: FileText },
  { id: "financial-accounts", label: "Contas e Saldos", icon: Wallet },
  { id: "financial-reserves", label: "Caixas de Reserva", icon: PiggyBank },
  { id: "categories", label: "Categorias", icon: Shield },
  {
    id: "reports-menu",
    label: "Relatórios",
    icon: FileText,
    children: [
      { id: "reports/profitability", label: "Lucratividade Por Operação", icon: TrendingUp },
      { id: "reports", label: "DRE Gerencial", icon: FileSpreadsheet },
      { id: "fuel-reports", label: "Relatório de Combustível", icon: BarChart3 },
      { id: "drivers-performance", label: "Performance", icon: Award },
    ],
  },
  { id: "bank-reconciliation", label: "Reconciliação", icon: DollarSign },
  { id: "chat", label: "Assistente IA", icon: MessageCircle },
  { id: "simulator", label: "Simulador", icon: Calculator },
  { id: "companies", label: "Empresas", icon: Building2 },
  { id: "users", label: "Usuários", icon: Users },
  { id: "settings", label: "Configurações", icon: Settings },
];

// Módulos controlados por permissão do Gestor
export const SIDEBAR_MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'journeys', label: 'Jornadas' },
  { key: 'vehicles', label: 'Veículos' },
  { key: 'drivers', label: 'Motoristas' },
  { key: 'fuel', label: 'Combustível' },
  { key: 'driver-uploads', label: 'Comprovantes' },
  { key: 'cte', label: 'CT-e' },
  { key: 'accounts', label: 'Contas' },
  { key: 'accounts-payable', label: 'Contas a Pagar' },
  { key: 'financial-accounts', label: 'Contas e Saldos' },
  { key: 'financial-reserves', label: 'Caixas de Reserva' },
  { key: 'categories', label: 'Categorias' },
  { key: 'reports-menu', label: 'Relatórios' },
  { key: 'bank-reconciliation', label: 'Reconciliação Bancária' },
  { key: 'chat', label: 'Assistente IA' },
  { key: 'simulator', label: 'Simulador' },
];

interface SidebarProps {
  onLogout: () => void;
  companyName?: string;
}

export default function Sidebar({
  onLogout,
  companyName = "Empresa Demo",
}: SidebarProps) {
  const { count: closureRequestsCount } = useClosureRequests();
  const { userProfile, currentCompany } = useMultiTenant();
  const impersonationData = localStorage.getItem('impersonation_data');
  const isImpersonating = !!impersonationData;
  const location = useLocation();

  // Permissões do Gestor (carregadas dinamicamente)
  const [gestorPermissions, setGestorPermissions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (userProfile?.role === 'gestor' && userProfile?.user_id && currentCompany?.id) {
      api.fetch(`/gestor-permissions?userId=${userProfile.user_id}`)
        .then((data: Record<string, boolean>) => setGestorPermissions(data))
        .catch(() => setGestorPermissions({}));
    }
  }, [userProfile?.user_id, currentCompany?.id]);

  const isModuleAllowed = (moduleId: string): boolean => {
    // Admin, master e outros papéis: tudo liberado
    if (!userProfile || userProfile.role !== 'gestor') return true;
    // Gestor: verificar permissões (se não há registro para o módulo, considerar habilitado)
    if (Object.keys(gestorPermissions).length === 0) return true;
    return gestorPermissions[moduleId] !== false;
  };

  // Check if current path is a report route
  const isReportRoute = ['/reports', '/reports/profitability', '/fuel-reports', '/drivers-performance'].some(
    route => location.pathname === route || location.pathname.startsWith(route + '/')
  );

  const [reportsOpen, setReportsOpen] = useState(isReportRoute);

  const visibleItems = sidebarItems.filter(item => isModuleAllowed(item.id));

  const renderMenuItem = (item: SidebarItem) => {
    const Icon = item.icon;
    const path = item.id === 'dashboard' ? '/home' : `/${item.id}`;

    if (item.children) {
      const visibleChildren = item.children.filter(child => isModuleAllowed(child.id));
      if (visibleChildren.length === 0) return null;

      return (
        <Collapsible
          key={item.id}
          open={reportsOpen}
          onOpenChange={setReportsOpen}
        >
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "w-full justify-between space-x-3 h-11",
                isReportRoute && "bg-primary/10 text-primary"
              )}
            >
              <div className="flex items-center space-x-3">
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  reportsOpen && "rotate-180"
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-4 space-y-1 mt-1">
            {visibleChildren.map((child) => {
              const ChildIcon = child.icon;
              const childPath = `/${child.id}`;
              return (
                <Button
                  key={child.id}
                  type="button"
                  variant="ghost"
                  asChild
                  className="w-full justify-start space-x-3 h-10"
                >
                  <NavLink
                    to={childPath}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center space-x-3 w-full",
                        isActive && "bg-primary/10 text-primary hover:bg-primary/10"
                      )
                    }
                    title={child.label}
                  >
                    <ChildIcon className="h-4 w-4" />
                    <span className="text-sm">{child.label}</span>
                  </NavLink>
                </Button>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return (
      <Button
        key={item.id}
        type="button"
        variant="ghost"
        asChild
        className="w-full justify-start space-x-3 h-11"
      >
        <NavLink
          to={path}
          className={({ isActive }) =>
            cn(
              "flex items-center space-x-3 w-full",
              isActive && "bg-primary/10 text-primary hover:bg-primary/10"
            )
          }
          title={item.label}
        >
          <Icon className="h-5 w-5" />
          <span className="flex-1">{item.label}</span>
          {item.id === 'journeys' && closureRequestsCount > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {closureRequestsCount}
            </Badge>
          )}
        </NavLink>
      </Button>
    );
  };

  return (
    <aside
      className="w-64 bg-card border-r border-border h-screen flex flex-col shadow-card"
      aria-label="Barra lateral de navegação"
    >
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="bg-primary p-2 rounded-lg shadow-primary">
            <Truck className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Frota Link</h1>
            <p className="text-sm text-muted-foreground">{companyName}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {/* Master Dashboard Button - only show if impersonating */}
        {isImpersonating && (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start space-x-3 h-11 mb-4 border-primary text-primary"
            onClick={() => window.location.href = '/master'}
            title="Voltar ao Painel Master"
          >
            <Shield className="h-5 w-5" />
            <span>Painel Master</span>
          </Button>
        )}

        {visibleItems.map(renderMenuItem)}
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
