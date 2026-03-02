import { useState, useEffect, useCallback } from 'react';

export interface WeatherData {
  tempC:     number;
  feelsLike: number;
  condition: string;
  icon:      string;
  humidity:  number;
  windKph:   number;
}

export interface GeoSuggestion {
  label:   string;   // "Oslo, Østland, Norway"
  lat:     number;
  lon:     number;
}

// WMO weather code → human label + emoji
function decodeWmo(code: number): { condition: string; icon: string } {
  if (code === 0)  return { condition: 'Clear sky',        icon: '☀️'  };
  if (code === 1)  return { condition: 'Mainly clear',     icon: '🌤️' };
  if (code === 2)  return { condition: 'Partly cloudy',    icon: '⛅' };
  if (code === 3)  return { condition: 'Overcast',         icon: '☁️'  };
  if (code <= 48)  return { condition: 'Foggy',            icon: '🌫️' };
  if (code <= 55)  return { condition: 'Drizzle',          icon: '🌦️' };
  if (code <= 57)  return { condition: 'Freezing drizzle', icon: '🌨️' };
  if (code <= 65)  return { condition: 'Rain',             icon: '🌧️' };
  if (code <= 67)  return { condition: 'Freezing rain',    icon: '🌨️' };
  if (code <= 77)  return { condition: 'Snow',             icon: '🌨️' };
  if (code <= 82)  return { condition: 'Rain showers',     icon: '🌦️' };
  if (code <= 86)  return { condition: 'Snow showers',     icon: '🌨️' };
  if (code === 95) return { condition: 'Thunderstorm',     icon: '⛈️'  };
  return                  { condition: 'Stormy',           icon: '⛈️'  };
}

/** Fetch current weather given precise coordinates — no geocoding step needed. */
export function useWeather(lat: number, lon: number) {
  const [data,    setData]    = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async (la: number, lo: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m` +
        `&wind_speed_unit=kmh&timezone=auto`,
      );
      const json = await res.json();
      const cur = json?.current;
      if (!cur) throw new Error('Weather data unavailable');
      const { condition, icon } = decodeWmo(cur.weather_code ?? 0);
      setData({
        tempC:     Math.round(cur.temperature_2m),
        feelsLike: Math.round(cur.apparent_temperature),
        condition,
        icon,
        humidity:  cur.relative_humidity_2m ?? 0,
        windKph:   Math.round(cur.wind_speed_10m ?? 0),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load weather');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(lat, lon); }, [lat, lon, load]);

  return { data, loading, error, refresh: () => load(lat, lon) };
}

/** Search for city suggestions — call this as the user types. */
export async function searchCities(query: string): Promise<GeoSuggestion[]> {
  if (query.trim().length < 2) return [];
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`,
  );
  const json = await res.json();
  return (json?.results ?? []).map((r: Record<string, unknown>) => ({
    label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    lat:   r.latitude as number,
    lon:   r.longitude as number,
  }));
}
