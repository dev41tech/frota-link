// Vehicle utility functions for axle configuration and type detection

export interface AxleConfig {
  totalAxles: number;
  frontAxles: number;
  rearAxles: number;
  description: string;
}

/**
 * Infer axle configuration from vehicle model string
 * Examples:
 * - "FH 540 6X4" → 3 axles (1 front + 2 rear)
 * - "SCANIA R450 6X2" → 3 axles (1 front + 2 rear)
 * - "ATEGO 2426 4X2" → 2 axles (1 front + 1 rear)
 * - "CONSTELLATION 8X4" → 4 axles (2 front + 2 rear)
 */
export function inferAxleConfig(model: string): AxleConfig {
  if (!model) {
    return { totalAxles: 2, frontAxles: 1, rearAxles: 1, description: '4x2' };
  }

  const upperModel = model.toUpperCase();
  
  // Look for patterns like "6X4", "4X2", "8X4", etc.
  const match = upperModel.match(/(\d)X(\d)/);
  
  if (match) {
    const wheels = parseInt(match[1]);
    const drivenWheels = parseInt(match[2]);
    const totalAxles = Math.ceil(wheels / 2);
    
    // For trucks with more than 3 axles, assume 2 front axles
    const frontAxles = totalAxles >= 4 ? 2 : 1;
    const rearAxles = totalAxles - frontAxles;
    
    return {
      totalAxles,
      frontAxles,
      rearAxles,
      description: `${wheels}x${drivenWheels}`
    };
  }

  // Default: 2 axles (4x2) for trucks
  return { totalAxles: 2, frontAxles: 1, rearAxles: 1, description: '4x2' };
}

/**
 * Infer trailer axle count from trailer type and model
 */
export function inferTrailerAxles(trailerType: string | null | undefined, model: string | null | undefined): number {
  const upperTrailerType = (trailerType || '').toUpperCase();
  const upperModel = (model || '').toUpperCase();
  
  // Check trailer type first
  if (upperTrailerType.includes('BITREM') || upperTrailerType.includes('BI-TREM')) {
    return 4; // Bitrem typically has 4 axles total (2 + 2)
  }
  if (upperTrailerType.includes('RODOTREM')) {
    return 6; // Rodotrem typically has 6 axles total
  }
  if (upperTrailerType.includes('VANDERLEIA') || upperTrailerType.includes('VANDERLÉIA')) {
    return 3;
  }
  
  // Check for axle mentions in model
  const axleMatch = upperModel.match(/(\d)\s*EIXO/);
  if (axleMatch) {
    return parseInt(axleMatch[1]);
  }
  
  // Look for common patterns
  if (upperModel.includes('TANDEM') || upperModel.includes('2 EIXOS')) {
    return 2;
  }
  if (upperModel.includes('TRI') || upperModel.includes('3 EIXOS')) {
    return 3;
  }
  
  // Default: 3 axles for semi-trailers
  return 3;
}

/**
 * Get tire positions based on vehicle type and axle count
 */
export interface TirePosition {
  id: string;
  label: string;
  shortLabel: string;
  axle: number;
  side: 'left' | 'right' | 'center';
  isInner?: boolean;
}

export function getTruckPositions(axleCount: number): TirePosition[] {
  const positions: TirePosition[] = [];
  
  // Front axle - always single tires
  positions.push(
    { id: 'DE', label: 'Dianteiro Esquerdo', shortLabel: 'DE', axle: 1, side: 'left' },
    { id: 'DD', label: 'Dianteiro Direito', shortLabel: 'DD', axle: 1, side: 'right' }
  );
  
  // Rear axles - dual tires
  for (let i = 2; i <= axleCount; i++) {
    const axlePrefix = axleCount > 2 ? `T${i - 1}` : 'T';
    positions.push(
      { id: `${axlePrefix}IE`, label: `Traseiro ${i - 1} Interno Esquerdo`, shortLabel: `${axlePrefix}IE`, axle: i, side: 'left', isInner: true },
      { id: `${axlePrefix}E`, label: `Traseiro ${i - 1} Externo Esquerdo`, shortLabel: `${axlePrefix}E`, axle: i, side: 'left', isInner: false },
      { id: `${axlePrefix}D`, label: `Traseiro ${i - 1} Externo Direito`, shortLabel: `${axlePrefix}D`, axle: i, side: 'right', isInner: false },
      { id: `${axlePrefix}ID`, label: `Traseiro ${i - 1} Interno Direito`, shortLabel: `${axlePrefix}ID`, axle: i, side: 'right', isInner: true }
    );
  }
  
  // Spare tire
  positions.push(
    { id: 'ESP', label: 'Estepe', shortLabel: 'ESP', axle: 0, side: 'center' }
  );
  
  return positions;
}

export function getTrailerPositions(axleCount: number): TirePosition[] {
  const positions: TirePosition[] = [];
  
  // All axles are dual tires
  for (let i = 1; i <= axleCount; i++) {
    const axlePrefix = `E${i}`;
    positions.push(
      { id: `${axlePrefix}IE`, label: `Eixo ${i} Interno Esquerdo`, shortLabel: `${axlePrefix}IE`, axle: i, side: 'left', isInner: true },
      { id: `${axlePrefix}E`, label: `Eixo ${i} Externo Esquerdo`, shortLabel: `${axlePrefix}E`, axle: i, side: 'left', isInner: false },
      { id: `${axlePrefix}D`, label: `Eixo ${i} Externo Direito`, shortLabel: `${axlePrefix}D`, axle: i, side: 'right', isInner: false },
      { id: `${axlePrefix}ID`, label: `Eixo ${i} Interno Direito`, shortLabel: `${axlePrefix}ID`, axle: i, side: 'right', isInner: true }
    );
  }
  
  // Spare tire
  positions.push(
    { id: 'ESP', label: 'Estepe', shortLabel: 'ESP', axle: 0, side: 'center' }
  );
  
  return positions;
}
