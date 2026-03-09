import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as LucideIcons from "lucide-react";

const COMMON_ICONS = [
  'Package', 'Fuel', 'Ticket', 'UtensilsCrossed', 'Hotel', 'Wrench', 'CircleDot',
  'Shield', 'Receipt', 'ParkingCircle', 'Truck', 'Award', 'DollarSign',
  'Banknote', 'CreditCard', 'Wallet', 'ShoppingCart', 'Tag', 'FileText',
  'Calendar', 'Clock', 'MapPin', 'Phone', 'Mail', 'Users', 'Building',
  'Home', 'Car', 'Plane', 'Ship', 'Train', 'Bus', 'Bike'
];

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export const IconPicker = ({ value, onChange }: IconPickerProps) => {
  const [search, setSearch] = useState("");

  const filteredIcons = COMMON_ICONS.filter(icon => 
    icon.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <Input
        placeholder="Buscar ícone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ScrollArea className="h-[200px] rounded-md border border-border p-3">
        <div className="grid grid-cols-6 gap-2">
          {filteredIcons.map((iconName) => {
            const IconComponent = (LucideIcons as any)[iconName];
            return (
              <button
                key={iconName}
                type="button"
                onClick={() => onChange(iconName)}
                className={`p-2 rounded-md hover:bg-accent transition-colors ${
                  value === iconName ? 'bg-accent border-2 border-primary' : 'border border-border'
                }`}
              >
                <IconComponent className="h-5 w-5" />
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
