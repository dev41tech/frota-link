import { Home, Receipt, History, BarChart3, Bell } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Início", href: "/driver", icon: Home },
  { name: "Lançamento", href: "/driver/expenses", icon: Receipt },
  { name: "Relatórios", href: "/driver/reports", icon: BarChart3 },
  { name: "Avisos", href: "/driver/chat", icon: Bell },
  { name: "Histórico", href: "/driver/history", icon: History },
];

export function BottomNavigation() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t backdrop-blur-sm bg-background/95 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
