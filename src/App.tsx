import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { MultiTenantProvider, useMultiTenant } from "@/hooks/useMultiTenant";
import { useDomainRouting } from "@/hooks/useDomainRouting";
import { usePasswordChangeRequired } from "@/hooks/usePasswordChangeRequired";
import { usePWA } from "@/hooks/usePWA";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { ForcePasswordChange } from "@/components/auth/ForcePasswordChange";
import { lazy, Suspense, useEffect } from "react";
import { toast } from "sonner";

// Eager loaded core pages
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import MasterDashboard from "./pages/MasterDashboard";
import AdminLayout from "@/layouts/AdminLayout";
import ClientLayout from "@/layouts/ClientLayout";
import { DriverLayout } from "@/layouts/DriverLayout";
import { RequireDriver } from "@/components/driver/RequireDriver";
import { RequireNonDriver } from "@/components/auth/RequireNonDriver";
import LandingPage from "@/components/landing/LandingPage";
import Dashboard from "@/components/dashboard/Dashboard";

// Lazy loaded pages for better performance
const Journeys = lazy(() => import("./pages/Journeys"));
const Vehicles = lazy(() => import("./pages/Vehicles"));
const Drivers = lazy(() => import("./pages/Drivers"));
const Fuel = lazy(() => import("./pages/Fuel"));
const CTe = lazy(() => import("./pages/CTe"));
const Accounts = lazy(() => import("./pages/Accounts"));
const AccountsPayable = lazy(() => import("./pages/AccountsPayable"));
const Expenses = lazy(() => import("./pages/Expenses"));
const ClientReports = lazy(() => import("./pages/Reports"));
const FuelReports = lazy(() => import("./pages/FuelReports"));
const BankReconciliation = lazy(() => import("./pages/BankReconciliation"));
const FinancialAccounts = lazy(() => import("./pages/FinancialAccounts"));
const FinancialReserves = lazy(() => import("./pages/FinancialReserves"));
const DriversPerformance = lazy(() => import("./pages/DriversPerformance"));
const ChatAssistant = lazy(() => import("./pages/ChatAssistant"));
const Simulator = lazy(() => import("./pages/Simulator"));
const Profitability = lazy(() => import("./pages/reports/Profitability"));
const TrailerUtilization = lazy(() => import("./pages/reports/TrailerUtilization"));
const ClientCompanies = lazy(() => import("./pages/Companies"));
const ClientUsers = lazy(() => import("./pages/Users"));
const ClientSettings = lazy(() => import("./pages/Settings"));
const MasterCompanies = lazy(() => import("./pages/master/Companies"));
const MasterUsers = lazy(() => import("./pages/master/Users"));
const Billing = lazy(() => import("./pages/master/Billing"));
const Plans = lazy(() => import("./pages/master/Plans"));
const Audit = lazy(() => import("./pages/master/Audit"));
const Alerts = lazy(() => import("./pages/master/Alerts"));
const MasterSettings = lazy(() => import("./pages/master/Settings"));
const Invoices = lazy(() => import("./pages/master/Invoices"));
const MRRAnalytics = lazy(() => import("./pages/master/MRRAnalytics"));
const PaymentSettings = lazy(() => import("./pages/master/PaymentSettings"));
const Overdue = lazy(() => import("./pages/master/Overdue"));
const CompaniesSuspended = lazy(() => import("./pages/master/CompaniesSuspended"));
const CreateCompany = lazy(() => import("./pages/master/CreateCompany"));
const UsageReport = lazy(() => import("./pages/master/UsageReport"));
const PerformanceReport = lazy(() => import("./pages/master/PerformanceReport"));
const HealthReport = lazy(() => import("./pages/master/HealthReport"));
const DriverExpenses = lazy(() => import("./pages/DriverExpenses"));
const DriverInstall = lazy(() => import("./pages/DriverInstall"));
const DriverDashboard = lazy(() => import("./pages/DriverDashboard"));
const DriverNewJourney = lazy(() => import("./pages/DriverNewJourney"));
const DriverHistory = lazy(() => import("./pages/DriverHistory"));
const DriverReports = lazy(() => import("./pages/DriverReports"));
const DriverChatPage = lazy(() => import("./pages/DriverChat"));
import ErrorBoundary from "@/components/layout/ErrorBoundary";
const Categories = lazy(() => import("./pages/Categories"));
const DriverUploads = lazy(() => import("./pages/DriverUploads"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const DriverAppManager = lazy(() => import("./pages/DriverAppManager"));
const DriverMessages = lazy(() => import("./pages/DriverMessages"));
const TeamManagement = lazy(() => import("./pages/master/TeamManagement"));
const BPOCompanySelector = lazy(() => import("./pages/BPOCompanySelector"));
const SupportCompanySearch = lazy(() => import("./pages/SupportCompanySearch"));
const Stock = lazy(() => import("./pages/Stock"));
const Parties = lazy(() => import("./pages/Parties"));
const FreightRates = lazy(() => import("./pages/FreightRates"));
const FreightRequests = lazy(() => import("./pages/FreightRequests"));
const CustomerPortal = lazy(() => import("./pages/CustomerPortal"));

/** * 📱 Skeleton Loader Otimizado para Mobile
 * Definido aqui no topo para evitar erro de referência (Hoisting)
 */
const MobilePageLoader = () => (
  <div className="flex flex-col h-full w-full p-4 space-y-6 animate-pulse bg-background">
    {/* Cabeçalho simulado */}
    <div className="flex items-center space-x-4">
      <div className="h-10 w-10 rounded-full bg-muted/60" />
      <div className="space-y-2 flex-1">
        <div className="h-4 w-1/3 bg-muted/60 rounded" />
        <div className="h-3 w-1/4 bg-muted/60 rounded" />
      </div>
    </div>

    {/* Card Principal (Ex: Status da Viagem) */}
    <div className="h-32 w-full rounded-xl bg-muted/40" />

    {/* Lista de Ações / Histórico */}
    <div className="space-y-3 pt-4">
      <div className="h-16 w-full rounded-lg bg-muted/30" />
      <div className="h-16 w-full rounded-lg bg-muted/30" />
      <div className="h-16 w-full rounded-lg bg-muted/30" />
    </div>
  </div>
);

/** ✅ Use o seu hook de auth de verdade com verificação de troca de senha */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { requiresChange, isChecking } = usePasswordChangeRequired();
  const loc = useLocation();

  if (loading || isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" state={{ from: loc }} replace />;

  // Força troca de senha se necessário
  if (requiresChange) {
    console.log("RequireAuth: Forçando troca de senha");
    return <ForcePasswordChange />;
  }

  return <>{children}</>;
}

/** Redirect authenticated users away from auth page with domain awareness */
function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isLandingDomain, redirectTo } = useDomainRouting();

  if (loading) return <div style={{ padding: 16 }}>Carregando…</div>;

  if (user) {
    if (isLandingDomain) {
      redirectTo("client", "/home");
      return <div style={{ padding: 16 }}>Redirecionando...</div>;
    }
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}

/** 🔀 Post-login redirect with domain enforcement and driver detection */
function PostLoginRedirect() {
  const { isMaster, isLoading } = useMultiTenant();
  const { isDriver, loading: driverLoading } = useDriverAuth();
  const { isBPO, isSupport, staffContext, isLoading: staffLoading } = useStaffAccess();
  const { isMasterDomain, isClientDomain, isLandingDomain, redirectTo } = useDomainRouting();

  if (isLoading || driverLoading || staffLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  // Motoristas sempre vão para área de motorista
  if (isDriver) {
    return <Navigate to="/driver" replace />;
  }

  // BPO sem contexto → seleção de empresa
  if (isBPO && !staffContext) {
    return <Navigate to="/select-company" replace />;
  }

  // Suporte sem contexto → busca de empresa
  if (isSupport && !staffContext) {
    return <Navigate to="/search-company" replace />;
  }

  // Master users
  if (isMaster) {
    return <Navigate to="/home" replace />;
  }

  return <Navigate to="/home" replace />;
}

/** Domain-aware 404 handler */
function DomainAwareNotFound() {
  const { user, loading } = useAuth();
  const { isLandingDomain, redirectTo } = useDomainRouting();

  if (loading) return <div style={{ padding: 16 }}>Carregando…</div>;

  if (user) {
    if (isLandingDomain) {
      redirectTo("client", "/home");
      return <div style={{ padding: 16 }}>Redirecionando...</div>;
    }
    return <Navigate to="/home" replace />;
  }

  if (isLandingDomain) {
    return <Navigate to="/" replace />;
  }

  return <NotFound />;
}

/** Domain-aware router component */
function DomainRouter() {
  const { isLandingDomain, isClientDomain, isMasterDomain } = useDomainRouting();
  const location = useLocation();
  const { user, loading: authLoading, signOut } = useAuth();
  const { isPWA } = usePWA();
  const { isDriver, loading: driverLoading } = useDriverAuth();

  // Landing domain - SEMPRE mostra a landing page pública, independente de autenticação
  if (isLandingDomain) {
    return (
      <Routes>
        {/* Landing page é sempre pública - não redireciona usuários logados */}
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/auth"
          element={
            <RedirectIfAuthenticated>
              <Auth />
            </RedirectIfAuthenticated>
          }
        />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Para rotas não encontradas na landing, simplesmente volta para a landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (isMasterDomain) {
    return (
      <Routes>
        <Route
          path="/auth"
          element={
            <RedirectIfAuthenticated>
              <Auth />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Navigate to="/home" replace />
            </RequireAuth>
          }
        />
        <Route
          path="/home"
          element={
            <RequireAuth>
              <AdminLayout>
                <MasterDashboard />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/companies"
          element={
            <RequireAuth>
              <AdminLayout>
                <MasterCompanies />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/billing"
          element={
            <RequireAuth>
              <AdminLayout>
                <Billing />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/billing/plans"
          element={
            <RequireAuth>
              <AdminLayout>
                <Plans />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/billing/invoices"
          element={
            <RequireAuth>
              <AdminLayout>
                <Invoices />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/billing/mrr"
          element={
            <RequireAuth>
              <AdminLayout>
                <MRRAnalytics />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/billing/settings"
          element={
            <RequireAuth>
              <AdminLayout>
                <PaymentSettings />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/billing/overdue"
          element={
            <RequireAuth>
              <AdminLayout>
                <Overdue />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/companies/suspended"
          element={
            <RequireAuth>
              <AdminLayout>
                <CompaniesSuspended />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/companies/create"
          element={
            <RequireAuth>
              <AdminLayout>
                <CreateCompany />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route path="/users" element={<Navigate to="/team?tab=users" replace />} />
        <Route path="/users/master" element={<Navigate to="/team?tab=users" replace />} />
        <Route path="/users/clients" element={<Navigate to="/team?tab=users" replace />} />
        <Route
          path="/reports"
          element={
            <RequireAuth>
              <AdminLayout>
                <ClientReports />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/reports/usage"
          element={
            <RequireAuth>
              <AdminLayout>
                <UsageReport />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/reports/performance"
          element={
            <RequireAuth>
              <AdminLayout>
                <PerformanceReport />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/reports/health"
          element={
            <RequireAuth>
              <AdminLayout>
                <HealthReport />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/audit"
          element={
            <RequireAuth>
              <AdminLayout>
                <Audit />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/alerts"
          element={
            <RequireAuth>
              <AdminLayout>
                <Alerts />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <AdminLayout>
                <MasterSettings />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/team"
          element={
            <RequireAuth>
              <AdminLayout>
                <TeamManagement />
              </AdminLayout>
            </RequireAuth>
          }
        />
        {/* Rota pública para reset de senha - NÃO exige autenticação */}
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<DomainAwareNotFound />} />
      </Routes>
    );
  }

  // Default to client domain behavior (includes isClientDomain and fallback)
  return (
    <Routes>
      <Route
        path="/auth"
        element={
          <RedirectIfAuthenticated>
            <Auth />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Navigate to="/home" replace />
          </RequireAuth>
        }
      />
      <Route path="/tenants/select" element={<Navigate to="/home" replace />} />
      <Route path="/overview" element={<Navigate to="/home" replace />} />

      {/* 🚛 DRIVER PWA ROUTES - OTIMIZADO PARA MOBILE & OFFLINE */}
      <Route
        element={
          <RequireAuth>
            <RequireDriver>
              {/* O Layout carrega primeiro e mantém a barra de navegação fixa */}
              <DriverLayout />
            </RequireDriver>
          </RequireAuth>
        }
      >
        {/* Dashboard Principal - Carregamento prioritário */}
        <Route
          path="/driver"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <DriverDashboard />
            </Suspense>
          }
        />

        {/* Rotas Operacionais - Usam Suspense individual para não travar a UI */}
        <Route
          path="/driver/new-journey"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <DriverNewJourney />
            </Suspense>
          }
        />

        <Route
          path="/driver/expenses"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <DriverExpenses />
            </Suspense>
          }
        />

        <Route
          path="/driver/history"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <DriverHistory />
            </Suspense>
          }
        />

        <Route
          path="/driver/reports"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <DriverReports />
            </Suspense>
          }
        />

        <Route
          path="/driver/chat"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <DriverChatPage />
            </Suspense>
          }
        />

        {/* Rota para Uploads Pendentes (Sugestão futura para offline-first) */}
        <Route
          path="/driver/uploads"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <DriverUploads />
            </Suspense>
          }
        />
      </Route>

      {/* Rota de instalação sem autenticação */}
      <Route path="/driver/install" element={<DriverInstall />} />

      {/* Client routes with real routing */}
      <Route
        element={
          <RequireAuth>
            <RequireNonDriver>
              <ClientLayout />
            </RequireNonDriver>
          </RequireAuth>
        }
      >
        <Route path="/home" element={<Dashboard />} />
        <Route
          path="/journeys"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <Journeys />
            </Suspense>
          }
        />
        <Route
          path="/vehicles"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <Vehicles />
            </Suspense>
          }
        />
        <Route
          path="/maintenance"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <Maintenance />
            </Suspense>
          }
        />
        <Route
          path="/stock"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <Stock />
            </Suspense>
          }
        />
        <Route
          path="/drivers"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <Drivers />
            </Suspense>
          }
        />
        <Route
          path="/fuel"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <Fuel />
            </Suspense>
          }
        />
        <Route
          path="/driver-uploads"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <DriverUploads />
            </Suspense>
          }
        />
        <Route
          path="/cte"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <CTe />
            </Suspense>
          }
        />
        <Route
          path="/accounts"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <Accounts />
            </Suspense>
          }
        />
        <Route
          path="/expenses"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <Expenses />
            </Suspense>
          }
        />
        <Route
          path="/accounts-payable"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <AccountsPayable />
            </Suspense>
          }
        />
        <Route
          path="/categories"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <Categories />
            </Suspense>
          }
        />
        <Route
          path="/parties"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <Parties />
            </Suspense>
          }
        />
        <Route
          path="/freight-rates"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <FreightRates />
            </Suspense>
          }
        />
        <Route
          path="/freight-requests"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <FreightRequests />
            </Suspense>
          }
        />
        <Route
          path="/reports"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <ClientReports />
            </Suspense>
          }
        />
        <Route
          path="/fuel-reports"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <FuelReports />
            </Suspense>
          }
        />
        <Route
          path="/bank-reconciliation"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <BankReconciliation />
            </Suspense>
          }
        />
        <Route
          path="/financial-accounts"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <FinancialAccounts />
            </Suspense>
          }
        />
        <Route
          path="/financial-reserves"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <FinancialReserves />
            </Suspense>
          }
        />
        <Route
          path="/drivers-performance"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <DriversPerformance />
            </Suspense>
          }
        />
        <Route
          path="/reports/profitability"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <Profitability />
            </Suspense>
          }
        />
        <Route
          path="/reports/trailer-utilization"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <TrailerUtilization />
            </Suspense>
          }
        />
        <Route
          path="/chat"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <ChatAssistant />
            </Suspense>
          }
        />
        <Route
          path="/simulator"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <Simulator />
            </Suspense>
          }
        />
        <Route
          path="/driver-app"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <DriverAppManager />
            </Suspense>
          }
        />
        <Route
          path="/driver-messages"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <DriverMessages />
            </Suspense>
          }
        />
        <Route
          path="/companies"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <ClientCompanies />
            </Suspense>
          }
        />
        <Route
          path="/users"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <ClientUsers />
            </Suspense>
          }
        />
        <Route
          path="/settings"
          element={
            <Suspense fallback={<MobilePageLoader />}>
              <ClientSettings />
            </Suspense>
          }
        />
      </Route>

      {/* Staff routes for BPO and Support */}
      <Route
        path="/select-company"
        element={
          <RequireAuth>
            <Suspense fallback={<MobilePageLoader />}>
              <BPOCompanySelector />
            </Suspense>
          </RequireAuth>
        }
      />
      <Route
        path="/search-company"
        element={
          <RequireAuth>
            <Suspense fallback={<MobilePageLoader />}>
              <SupportCompanySearch />
            </Suspense>
          </RequireAuth>
        }
      />

      {/* Rota pública para reset de senha - NÃO exige autenticação */}
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Portal público do cliente - URL amigável */}
      <Route
        path="/portal/:companySlug/:shortCode"
        element={
          <Suspense fallback={<MobilePageLoader />}>
            <CustomerPortal />
          </Suspense>
        }
      />
      {/* Portal público do cliente - Legacy UUID token */}
      <Route
        path="/portal/:token"
        element={
          <Suspense fallback={<MobilePageLoader />}>
            <CustomerPortal />
          </Suspense>
        }
      />

      <Route path="*" element={<DomainAwareNotFound />} />
    </Routes>
  );
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <AuthProvider>
        <MultiTenantProvider>
          <TooltipProvider>
            {/* Toaster padrão do shadcn/ui */}
            <Toaster />

            {/* Toaster do Sonner (para notificações mais bonitas/mobile) */}
            <Sonner />

            <BrowserRouter>
              <DomainRouter />
            </BrowserRouter>
          </TooltipProvider>
        </MultiTenantProvider>
      </AuthProvider>
    </ErrorBoundary>
  </QueryClientProvider>
);

export default App;
