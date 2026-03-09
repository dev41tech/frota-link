import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { SidebarProvider, useSidebarContext } from "./SidebarContext";
import { SidebarContent } from "./SidebarContent";

interface OptimizedSidebarProps {
  onLogout: () => void;
  companyName?: string;
}

function SidebarDesktop({ onLogout, companyName }: OptimizedSidebarProps) {
  const { isCollapsed } = useSidebarContext();

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-card border-r border-border h-screen shadow-card transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
      aria-label="Barra lateral de navegação"
    >
      <TooltipProvider>
        <SidebarContent
          companyName={companyName || "Frota Link"}
          onLogout={onLogout}
        />
      </TooltipProvider>
    </aside>
  );
}

function SidebarMobile({ onLogout, companyName }: OptimizedSidebarProps) {
  const { isMobileOpen, setMobileOpen } = useSidebarContext();

  return (
    <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden fixed top-3 left-3 z-50 bg-card shadow-md"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Abrir menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-72">
        <TooltipProvider>
          <SidebarContent
            companyName={companyName || "Frota Link"}
            onLogout={onLogout}
            onNavigate={() => setMobileOpen(false)}
          />
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  );
}

function SidebarInner(props: OptimizedSidebarProps) {
  const isMobile = useIsMobile();

  return (
    <>
      <SidebarDesktop {...props} />
      {isMobile && <SidebarMobile {...props} />}
    </>
  );
}

export default function OptimizedSidebar(props: OptimizedSidebarProps) {
  return (
    <SidebarProvider>
      <SidebarInner {...props} />
    </SidebarProvider>
  );
}

export { SidebarProvider, useSidebarContext };
