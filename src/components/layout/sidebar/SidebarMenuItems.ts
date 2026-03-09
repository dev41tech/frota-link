import {
  Truck,
  Route,
  CreditCard,
  FileText,
  Calculator,
  Users,
  Settings,
  BarChart3,
  Fuel,
  MessageCircle,
  MessageSquareText,
  Award,
  UserPlus,
  Building2,
  Shield,
  TrendingUp,
  DollarSign,
  FileImage,
  FileSpreadsheet,
  Package,
  Wallet,
  Wrench,
  Hammer,
  Smartphone,
  Briefcase,
  type LucideIcon,
} from "lucide-react";


export type FeatureKey = "simulator" | "ai" | "copilot" | "pwaDriver" | "dedicatedSupport" | "geolocation" | "cteModule" | "couplingModule";

export interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: MenuItem[];
  requiredFeature?: FeatureKey;
  requiredPlan?: string;
}

export interface MenuGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: MenuItem[];
}

// Item direto sem grupo
export const dashboardItem: MenuItem = {
  id: "dashboard",
  label: "Dashboard",
  icon: BarChart3,
  href: "/home",
};

// Grupos organizados logicamente
export const menuGroups: MenuGroup[] = [
  {
    id: "operation",
    label: "Operação",
    icon: Package,
    items: [
      { id: "journeys", label: "Jornadas", icon: Route, href: "/journeys" },
      { id: "driver-uploads", label: "Comprovantes", icon: FileImage, href: "/driver-uploads" },
      { id: "vehicles", label: "Veículos", icon: Truck, href: "/vehicles" },
      { id: "maintenance", label: "Manutenções / Pneus", icon: Hammer, href: "/maintenance" },
      { id: "stock", label: "Almoxarifado", icon: Package, href: "/stock" },
      { id: "drivers", label: "Motoristas", icon: UserPlus, href: "/drivers" },
      { id: "fuel", label: "Combustível", icon: Fuel, href: "/fuel" },
      {
        id: "driver-messages",
        label: "Avisos e Ocorrências",
        icon: MessageSquareText,
        href: "/driver-messages",
        requiredFeature: "pwaDriver",
        requiredPlan: "Enterprise",
      },
    ],
  },
  {
    id: "documents",
    label: "Documentos",
    icon: FileText,
    items: [
      { id: "cte", label: "CT-e", icon: FileText, href: "/cte", requiredFeature: "cteModule", requiredPlan: "Add-on" },
    ],
  },
  {
    id: "commercial",
    label: "Comercial",
    icon: Briefcase,
    items: [
      { id: "parties", label: "Clientes", icon: Users, href: "/parties" },
      { id: "freight-rates", label: "Tabela de Frete", icon: DollarSign, href: "/freight-rates" },
      { id: "freight-requests", label: "Solicitações de Frete", icon: FileText, href: "/freight-requests" },
      { id: "simulator", label: "Simulador", icon: Calculator, href: "/simulator", requiredFeature: "simulator", requiredPlan: "Pro" },
    ],
  },
  {
    id: "financial",
    label: "Financeiro",
    icon: Wallet,
    items: [
      { id: "accounts", label: "Receitas", icon: DollarSign, href: "/accounts" },
      { id: "expenses", label: "Despesas", icon: CreditCard, href: "/expenses" },
      { id: "accounts-payable", label: "Contas a Pagar", icon: FileText, href: "/accounts-payable" },
      { id: "suppliers", label: "Fornecedores", icon: Building2, href: "/parties?tab=supplier" },
      { id: "bank-reconciliation", label: "Reconciliação", icon: TrendingUp, href: "/bank-reconciliation" },
      { id: "categories", label: "Categorias", icon: Shield, href: "/categories" },
    ],
  },
  {
    id: "reports",
    label: "Relatórios",
    icon: BarChart3,
    items: [
      { id: "profitability", label: "Análise Operacional", icon: TrendingUp, href: "/reports/profitability" },
      { id: "dre", label: "DRE Gerencial", icon: FileSpreadsheet, href: "/reports" },
      { id: "trailer-utilization", label: "Utilização de Carretas", icon: Package, href: "/reports/trailer-utilization", requiredFeature: "couplingModule", requiredPlan: "Add-on" },
      { id: "fuel-reports", label: "Relatório de Combustível", icon: BarChart3, href: "/fuel-reports" },
      { id: "performance", label: "Performance", icon: Award, href: "/drivers-performance" },
    ],
  },
  {
    id: "tools",
    label: "Ferramentas",
    icon: Wrench,
    items: [
      {
        id: "chat",
        label: "Assistente IA",
        icon: MessageCircle,
        href: "/chat",
        requiredFeature: "ai",
        requiredPlan: "Pro",
      },
      {
        id: "driver-app",
        label: "App Motorista",
        icon: Smartphone,
        href: "/driver-app",
        requiredFeature: "pwaDriver",
        requiredPlan: "Enterprise",
      },
    ],
  },
  {
    id: "admin",
    label: "Administração",
    icon: Settings,
    items: [
      { id: "companies", label: "Empresas", icon: Building2, href: "/companies" },
      { id: "users", label: "Usuários", icon: Users, href: "/users" },
      { id: "settings", label: "Configurações", icon: Settings, href: "/settings" },
    ],
  },
];
