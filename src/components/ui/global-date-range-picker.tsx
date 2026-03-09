import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, subQuarters, startOfQuarter, endOfQuarter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type DatePreset = 
  | "today" 
  | "7d" 
  | "15d" 
  | "30d" 
  | "60d" 
  | "90d" 
  | "current-month" 
  | "last-month" 
  | "last-quarter"
  | "ytd" 
  | "last-year" 
  | "last-12-months"
  | "custom";

interface GlobalDateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onDateChange: (start: Date, end: Date, preset?: DatePreset) => void;
  activePreset?: DatePreset;
  showPresets?: boolean;
  className?: string;
}

const PRESETS: { id: DatePreset; label: string; getRange: () => { start: Date; end: Date } }[] = [
  { 
    id: "today", 
    label: "Hoje", 
    getRange: () => ({ start: new Date(), end: new Date() }) 
  },
  { 
    id: "7d", 
    label: "7 dias", 
    getRange: () => ({ start: subDays(new Date(), 7), end: new Date() }) 
  },
  { 
    id: "15d", 
    label: "15 dias", 
    getRange: () => ({ start: subDays(new Date(), 15), end: new Date() }) 
  },
  { 
    id: "30d", 
    label: "30 dias", 
    getRange: () => ({ start: subDays(new Date(), 30), end: new Date() }) 
  },
  { 
    id: "60d", 
    label: "60 dias", 
    getRange: () => ({ start: subDays(new Date(), 60), end: new Date() }) 
  },
  { 
    id: "90d", 
    label: "90 dias", 
    getRange: () => ({ start: subDays(new Date(), 90), end: new Date() }) 
  },
  { 
    id: "current-month", 
    label: "Mês Atual", 
    getRange: () => ({ start: startOfMonth(new Date()), end: new Date() }) 
  },
  { 
    id: "last-month", 
    label: "Mês Anterior", 
    getRange: () => {
      const lastMonth = subMonths(new Date(), 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    } 
  },
  { 
    id: "last-quarter", 
    label: "Último Trimestre", 
    getRange: () => {
      const lastQuarter = subQuarters(new Date(), 1);
      return { start: startOfQuarter(lastQuarter), end: endOfQuarter(lastQuarter) };
    } 
  },
  { 
    id: "ytd", 
    label: "Ano Atual (YTD)", 
    getRange: () => ({ start: startOfYear(new Date()), end: new Date() }) 
  },
  { 
    id: "last-year", 
    label: "Ano Anterior", 
    getRange: () => {
      const lastYear = subMonths(new Date(), 12);
      return { start: startOfYear(lastYear), end: new Date(lastYear.getFullYear(), 11, 31) };
    } 
  },
  { 
    id: "last-12-months", 
    label: "Últimos 12 meses", 
    getRange: () => ({ start: subMonths(new Date(), 12), end: new Date() }) 
  },
];

export function GlobalDateRangePicker({
  startDate,
  endDate,
  onDateChange,
  activePreset,
  showPresets = true,
  className,
}: GlobalDateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const handlePresetClick = (preset: typeof PRESETS[number]) => {
    const range = preset.getRange();
    onDateChange(range.start, range.end, preset.id);
    setOpen(false);
  };

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      onDateChange(range.from, range.to, "custom");
    } else if (range?.from) {
      onDateChange(range.from, range.from, "custom");
    }
  };

  const getActiveLabel = () => {
    if (activePreset && activePreset !== "custom") {
      const preset = PRESETS.find(p => p.id === activePreset);
      if (preset) return preset.label;
    }
    return `${format(startDate, "dd/MM/yy")} - ${format(endDate, "dd/MM/yy")}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-start text-left font-normal", className)}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span>{getActiveLabel()}</span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {showPresets && (
            <div className="border-r p-2 space-y-1 min-w-[140px]">
              <p className="text-xs text-muted-foreground px-2 py-1">Atalhos</p>
              {PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  variant={activePreset === preset.id ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          )}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={{ from: startDate, to: endDate }}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              locale={ptBR}
              disabled={{ after: new Date() }}
            />
            <div className="flex items-center justify-between pt-3 border-t mt-3">
              <div className="text-xs text-muted-foreground">
                {format(startDate, "dd MMM yyyy", { locale: ptBR })} —{" "}
                {format(endDate, "dd MMM yyyy", { locale: ptBR })}
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  const range = PRESETS.find(p => p.id === "30d")!.getRange();
                  onDateChange(range.start, range.end, "30d");
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
