import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Bell, AlertCircle } from "lucide-react";
import { DriverAnnouncements } from "@/components/driver/DriverAnnouncements";
import { DriverIncidents } from "@/components/driver/DriverIncidents";

export default function DriverChatPage() {
  const navigate = useNavigate();
  const { isDriver, loading: authLoading } = useDriverAuth();

  useEffect(() => {
    if (!authLoading && !isDriver) {
      navigate("/auth");
    }
  }, [authLoading, isDriver, navigate]);

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-20">
        <div className="container mx-auto max-w-3xl px-4 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/driver")}
            className="rounded-full -ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-base font-bold">Avisos e Ocorrências</h1>
            <p className="text-xs text-muted-foreground">Comunicados e registro de eventos</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 container mx-auto max-w-3xl p-4">
        <Tabs defaultValue="announcements" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="announcements" className="flex items-center gap-1.5">
              <Bell className="h-4 w-4" />
              Avisos
            </TabsTrigger>
            <TabsTrigger value="incidents" className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              Ocorrências
            </TabsTrigger>
          </TabsList>

          <TabsContent value="announcements" className="mt-4">
            <DriverAnnouncements />
          </TabsContent>

          <TabsContent value="incidents" className="mt-4">
            <DriverIncidents />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
