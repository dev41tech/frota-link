import { Button } from "@/components/ui/button";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subDays,
} from "date-fns";

interface PeriodPresetsProps {
  onSelect: (start: Date, end: Date) => void;
  activePreset?: string;
}

export function PeriodPresets({ onSelect, activePreset }: PeriodPresetsProps) {
  const today = new Date();

  const presets = [
    {
      id: "current-month",
      label: "Mês Atual",
      getRange: () => ({
        start: startOfMonth(today),
        end: endOfMonth(today),
      }),
    },
    {
      id: "last-30",
      label: "Últimos 30 dias",
      getRange: () => ({
        start: subDays(today, 30),
        end: today,
      }),
    },
    {
      id: "last-month",
      label: "Mês Anterior",
      getRange: () => {
        const lastMonth = subMonths(today, 1);
        return {
          start: startOfMonth(lastMonth),
          end: endOfMonth(lastMonth),
        };
      },
    },
    {
      id: "quarter",
      label: "Trimestre",
      getRange: () => ({
        start: startOfQuarter(today),
        end: endOfQuarter(today),
      }),
    },
    {
      id: "year",
      label: "Ano",
      getRange: () => ({
        start: startOfYear(today),
        end: endOfYear(today),
      }),
    },
  ];

  const handleSelect = (preset: (typeof presets)[0]) => {
    const { start, end } = preset.getRange();
    onSelect(start, end);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => (
        <Button
          key={preset.id}
          variant={activePreset === preset.id ? "default" : "outline"}
          size="sm"
          onClick={() => handleSelect(preset)}
          className="text-xs h-8"
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
}
