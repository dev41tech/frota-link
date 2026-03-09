import { Calendar, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ReportViewMode = 'competency' | 'journey';

interface ReportViewModeSelectorProps {
  mode: ReportViewMode;
  onChange: (mode: ReportViewMode) => void;
}

export function ReportViewModeSelector({ mode, onChange }: ReportViewModeSelectorProps) {
  return (
    <TooltipProvider>
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mode === 'competency' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onChange('competency')}
              className={`h-8 px-3 gap-2 text-xs font-medium transition-all ${
                mode === 'competency' 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Competência
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[280px]">
            <p className="text-xs">
              Cada lançamento aparece no mês da sua própria data. 
              Uma jornada de Janeiro com despesas em Fevereiro mostra as despesas em Fevereiro.
            </p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mode === 'journey' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onChange('journey')}
              className={`h-8 px-3 gap-2 text-xs font-medium transition-all ${
                mode === 'journey' 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Truck className="h-3.5 w-3.5" />
              Por Jornada
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[280px]">
            <p className="text-xs">
              Todas as despesas e receitas são agrupadas no mês de início da jornada. 
              Ideal para análise de rentabilidade por viagem.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
