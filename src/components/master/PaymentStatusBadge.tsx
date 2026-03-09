import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertTriangle, XCircle, CreditCard } from "lucide-react";

interface PaymentStatusBadgeProps {
  status?: string | null;
  hasSubscription?: boolean;
}

export default function PaymentStatusBadge({ status, hasSubscription }: PaymentStatusBadgeProps) {
  if (!hasSubscription) {
    return (
      <Badge variant="outline" className="gap-1">
        <CreditCard className="h-3 w-3" />
        Sem assinatura
      </Badge>
    );
  }

  switch (status) {
    case 'active':
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1">
          <CheckCircle className="h-3 w-3" />
          Em dia
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 gap-1">
          <Clock className="h-3 w-3" />
          Pendente
        </Badge>
      );
    case 'overdue':
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Inadimplente
        </Badge>
      );
    case 'suspended':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Suspenso
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          {status || 'Indefinido'}
        </Badge>
      );
  }
}