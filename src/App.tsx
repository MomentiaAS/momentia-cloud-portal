import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage }     from './pages/Dashboard/DashboardPage';
import { CustomersPage }     from './pages/Customers/CustomersPage';
import { SupportPage }       from './pages/Support/SupportPage';
import { LogsPage }          from './pages/Logs/LogsPage';
import { BackupPage }        from './pages/Backup/BackupPage';
import { NotificationsPage } from './pages/Notifications/NotificationsPage';
import { SettingsPage }      from './pages/Settings/SettingsPage';

function Router() {
  return (
    <AppShell>
      <Routes>
        <Route path="/"              element={<DashboardPage />} />
        <Route path="/customers"     element={<CustomersPage />} />
        <Route path="/support"       element={<SupportPage />} />
        <Route path="/logs"          element={<LogsPage />} />
        <Route path="/backup"        element={<BackupPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings"      element={<SettingsPage />} />
        <Route path="*"              element={<NotFound />} />
      </Routes>
    </AppShell>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
      <p className="text-5xl font-bold text-text-muted">404</p>
      <p className="text-lg font-semibold text-text-primary">Page not found</p>
      <a href="/" className="text-sm text-accent hover:underline">Back to dashboard</a>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AppProvider>
          <Router />
        </AppProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
