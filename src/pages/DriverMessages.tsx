import { FeatureGate } from '@/components/subscription/FeatureGate';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, AlertCircle } from 'lucide-react';
import { AnnouncementList } from '@/components/announcements/AnnouncementList';
import { IncidentList } from '@/components/incidents/IncidentList';

export default function DriverMessages() {
  return (
    <FeatureGate feature="pwaDriver">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Avisos e Ocorrências</h1>
          <p className="text-sm text-muted-foreground">
            Comunicados oficiais e registro de eventos operacionais
          </p>
        </div>

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
            <AnnouncementList />
          </TabsContent>

          <TabsContent value="incidents" className="mt-4">
            <IncidentList />
          </TabsContent>
        </Tabs>
      </div>
    </FeatureGate>
  );
}
