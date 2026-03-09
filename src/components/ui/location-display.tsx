import { MapPin, ExternalLink } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

interface LocationDisplayProps {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  compact?: boolean;
}

export function LocationDisplay({ lat, lng, address, compact = false }: LocationDisplayProps) {
  if (!lat && !lng && !address) {
    return compact ? null : (
      <span className="text-xs text-muted-foreground">-</span>
    );
  }

  const hasCoordinates = lat && lng;
  const mapsUrl = hasCoordinates 
    ? `https://www.google.com/maps?q=${lat},${lng}` 
    : address 
      ? `https://www.google.com/maps/search/${encodeURIComponent(address)}`
      : null;

  // Truncate address for display
  const displayAddress = address 
    ? address.length > 30 
      ? `${address.substring(0, 30)}...` 
      : address
    : hasCoordinates 
      ? `${lat?.toFixed(4)}, ${lng?.toFixed(4)}`
      : null;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {mapsUrl ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(mapsUrl, '_blank');
                }}
              >
                <MapPin className="h-3.5 w-3.5 text-primary" />
              </Button>
            ) : (
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">{address || `${lat?.toFixed(6)}, ${lng?.toFixed(6)}`}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`flex items-center gap-1.5 text-sm ${mapsUrl ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
            onClick={() => mapsUrl && window.open(mapsUrl, '_blank')}
          >
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate max-w-[150px]">{displayAddress}</span>
            {mapsUrl && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />}
          </div>
        </TooltipTrigger>
        {address && address.length > 30 && (
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">{address}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
