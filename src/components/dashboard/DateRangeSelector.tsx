import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface DateRangeSelectorProps {
  preset: '7d' | '15d' | '30d' | '60d' | '90d' | 'custom';
  startDate: Date;
  endDate: Date;
  onChange: (preset: string, start: Date, end: Date) => void;
}

export function DateRangeSelector({ preset, startDate, endDate, onChange }: DateRangeSelectorProps) {
  const presets = [
    { label: 'Últimos 7 dias', value: '7d', days: 7 },
    { label: 'Últimos 15 dias', value: '15d', days: 15 },
    { label: 'Últimos 30 dias', value: '30d', days: 30 },
    { label: 'Últimos 60 dias', value: '60d', days: 60 },
    { label: 'Últimos 90 dias', value: '90d', days: 90 },
  ];

  const handlePresetClick = (value: string, days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onChange(value, start, end);
  };

  const handleCustomDateChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      onChange('custom', range.from, range.to);
    }
  };

  return (
    <div className="space-y-2">
      {/* Botões de Preset */}
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Button
            key={p.value}
            variant={preset === p.value ? "default" : "outline"}
            size="sm"
            onClick={() => handlePresetClick(p.value, p.days)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Seletor de Período Customizado */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={preset === 'custom' ? "default" : "outline"}
            size="sm"
            className="w-full justify-start"
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            {preset === 'custom' 
              ? `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`
              : 'Período Customizado'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={{ from: startDate, to: endDate }}
            onSelect={handleCustomDateChange}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
