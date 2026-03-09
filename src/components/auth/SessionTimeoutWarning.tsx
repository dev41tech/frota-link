import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock } from "lucide-react";

interface SessionTimeoutWarningProps {
  open: boolean;
  timeLeft: number;
  onExtend: () => void;
}

export function SessionTimeoutWarning({
  open,
  timeLeft,
  onExtend,
}: SessionTimeoutWarningProps) {
  const secondsLeft = Math.ceil(timeLeft / 1000);
  const minutesLeft = Math.floor(secondsLeft / 60);
  const remainingSeconds = secondsLeft % 60;

  const timeDisplay = minutesLeft > 0 
    ? `${minutesLeft}:${remainingSeconds.toString().padStart(2, '0')}`
    : `${remainingSeconds}s`;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Sessão expirando
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            Sua sessão expirará em <span className="font-bold text-foreground">{timeDisplay}</span> devido à inatividade.
            <br />
            <br />
            Clique em "Continuar conectado" para manter sua sessão ativa.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onExtend}>
            Continuar conectado
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
