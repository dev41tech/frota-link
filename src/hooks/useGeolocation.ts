import { useState } from 'react';

export interface GeolocationData {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy: number;
}

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentPosition = (): Promise<GeolocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('Geolocalização não suportada');
        return;
      }

      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          try {
            // Tentar obter endereço via reverse geocoding (Nominatim - OpenStreetMap)
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const data = await response.json();
            const address = data.display_name || undefined;

            setLoading(false);
            resolve({ latitude, longitude, address, accuracy });
          } catch {
            // Se falhar, retornar sem endereço
            setLoading(false);
            resolve({ latitude, longitude, accuracy });
          }
        },
        (err) => {
          setLoading(false);
          setError(err.message);
          reject(err.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  };

  return { getCurrentPosition, loading, error };
}
