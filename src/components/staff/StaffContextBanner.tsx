import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Wrench, ArrowLeft } from "lucide-react";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { useNavigate } from "react-router-dom";

export default function StaffContextBanner() {
  const { staffContext, staffRole, clearCompanyContext } = useStaffAccess();
  const navigate = useNavigate();
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    if (!staffContext) return;

    const startTime = new Date(staffContext.accessed_at).getTime();
    
    const updateTime = () => {
      setTimeElapsed(Math.round((Date.now() - startTime) / 60000));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    
    return () => clearInterval(interval);
  }, [staffContext?.accessed_at]);

  const handleEndAccess = async () => {
    try {
      await clearCompanyContext();
      
      // Redirect based on role
      if (staffRole === 'bpo') {
        navigate('/select-company');
      } else if (staffRole === 'suporte') {
        navigate('/search-company');
      } else {
        navigate('/home');
      }
    } catch (error) {
      console.error('Error ending access:', error);
    }
  };

  if (!staffContext) return null;

  const isBPO = staffContext.accessed_as === 'bpo';
  const isSupport = staffContext.accessed_as === 'suporte';

  return (
    <Alert 
      className={`mb-0 rounded-none border-x-0 border-t-0 ${
        isBPO 
          ? 'bg-primary/10 border-primary/20' 
          : 'bg-amber-500/10 border-amber-500/20'
      }`}
    >
      {isBPO ? (
        <Shield className="h-4 w-4 text-primary" />
      ) : (
        <Wrench className="h-4 w-4 text-amber-600" />
      )}
      <AlertDescription className="flex items-center justify-between w-full">
        <span className="text-sm">
          <strong className={isBPO ? 'text-primary' : 'text-amber-600'}>
            {isBPO ? 'ACESSO BPO:' : 'ACESSO SUPORTE:'}
          </strong>{" "}
          Você está acessando{" "}
          <strong>{staffContext.company_name}</strong>.
          Tempo: {timeElapsed}min. Todas as ações serão registradas.
        </span>
        <Button 
          variant={isBPO ? "outline" : "secondary"}
          size="sm" 
          onClick={handleEndAccess}
          className="ml-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {isBPO ? 'Trocar Empresa' : 'Encerrar'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
