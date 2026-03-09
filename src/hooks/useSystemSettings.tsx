import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  setting_type: string;
  description: string | null;
  updated_at: string;
}

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .order("setting_type", { ascending: true });

      if (error) throw error;
      setSettings(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar configurações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getSetting = (key: string): any => {
    const setting = settings.find((s) => s.setting_key === key);
    return setting?.setting_value;
  };

  const updateSetting = async (key: string, value: any, type: string, description?: string) => {
    try {
      const { error } = await supabase
        .from("system_settings")
        .upsert({
          setting_key: key,
          setting_value: value,
          setting_type: type,
          description: description || null,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (error) throw error;

      toast({
        title: "Configuração salva",
        description: "A configuração foi atualizada com sucesso",
      });

      await fetchSettings();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar configuração",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return {
    settings,
    loading,
    getSetting,
    updateSetting,
    refreshSettings: fetchSettings,
  };
}
