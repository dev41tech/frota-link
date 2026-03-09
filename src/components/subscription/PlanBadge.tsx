import { cn } from '@/lib/utils';

interface PlanBadgeProps {
  plan: 'PRO' | 'ENTERPRISE' | 'CONCIERGE';
  className?: string;
}

const badgeColors: Record<string, string> = {
  PRO: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  ENTERPRISE: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  CONCIERGE: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
};

export function PlanBadge({ plan, className }: PlanBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border',
        badgeColors[plan],
        className
      )}
    >
      {plan}
    </span>
  );
}
