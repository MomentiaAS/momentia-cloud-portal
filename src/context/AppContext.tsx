import { createContext, useContext, useState, type ReactNode } from 'react';
import { demoWeather } from '../data/demo';

interface AppContextValue {
  sidebarOpen:    boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar:  () => void;
  notificationCount: number;
  weatherCity:    string;
  setWeatherCity: (city: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [weatherCity, setWeatherCityState] = useState<string>(
    () => localStorage.getItem('momentia-weather-city') ?? demoWeather.city,
  );

  const toggleSidebar = () => setSidebarOpen(v => !v);

  const setWeatherCity = (city: string) => {
    const trimmed = city.trim();
    if (!trimmed) return;
    localStorage.setItem('momentia-weather-city', trimmed);
    setWeatherCityState(trimmed);
  };

  return (
    <AppContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
        notificationCount: 4,
        weatherCity,
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
