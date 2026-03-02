import { createContext, useContext, useState, type ReactNode } from 'react';

export interface WeatherLocation {
  label: string;   // Display name, e.g. "Oslo, Norway"
  lat:   number;
  lon:   number;
}

const DEFAULT_LOCATION: WeatherLocation = { label: 'Oslo, Norway', lat: 59.9139, lon: 10.7522 };
const LS_KEY = 'momentia-weather-location';

function loadLocation(): WeatherLocation {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as WeatherLocation;
  } catch { /* ignore */ }
  return DEFAULT_LOCATION;
}

interface AppContextValue {
  sidebarOpen:         boolean;
  setSidebarOpen:      (open: boolean) => void;
  toggleSidebar:       () => void;
  notificationCount:   number;
  weatherLocation:     WeatherLocation;
  setWeatherLocation:  (loc: WeatherLocation) => void;
  /** @deprecated use weatherLocation.label */
  weatherCity:         string;
  /** @deprecated use setWeatherLocation */
  setWeatherCity:      (city: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [weatherLocation, setWeatherLocationState] = useState<WeatherLocation>(loadLocation);

  const toggleSidebar = () => setSidebarOpen(v => !v);

  const setWeatherLocation = (loc: WeatherLocation) => {
    localStorage.setItem(LS_KEY, JSON.stringify(loc));
    setWeatherLocationState(loc);
  };

  // Legacy shim so nothing else breaks
  const setWeatherCity = (city: string) => {
    setWeatherLocation({ ...weatherLocation, label: city });
  };

  return (
    <AppContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
        notificationCount: 4,
        weatherLocation,
        setWeatherLocation,
        weatherCity:    weatherLocation.label,
        setWeatherCity,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
