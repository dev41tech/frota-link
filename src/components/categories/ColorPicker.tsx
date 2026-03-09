const PRESET_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#6366F1', '#DC2626', '#14B8A6', '#6B7280',
  '#059669', '#7C3AED', '#DB2777', '#2563EB', '#EA580C'
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export const ColorPicker = ({ value, onChange }: ColorPickerProps) => {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`h-10 w-full rounded-md transition-all ${
              value === color ? 'ring-2 ring-primary ring-offset-2' : 'border border-border'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-20 rounded-md border border-border cursor-pointer"
        />
        <span className="text-sm text-muted-foreground">{value}</span>
      </div>
    </div>
  );
};
