import { type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider }  from './context/ThemeContext';
import { AuthProvider, useAuth }   from './context/AuthContext';
import { AppProvider }   from './context/AppContext';
import { AppShell }      from './components/layout/AppShell';
import { LoginPage }          from './pages/Auth/LoginPage';
import { DashboardPage }      from './pages/Dashboard/DashboardPage';
import { CustomersPage }       from './pages/Customers/CustomersPage';
import { CustomerDetailPage }  from './pages/Customers/CustomerDetailPage';
import { SupportPage }        from './pages/Support/SupportPage';
import { LogsPage }           from './pages/Logs/LogsPage';
import { BackupPage }         from './pages/Backup/BackupPage';
import { NotificationsPage }  from './pages/Notifications/NotificationsPage';
import { SettingsPage }       from './pages/Settings/SettingsPage';
import { UsersPage }          from './pages/Users/UsersPage';
import { UnifiSitesPage }     from './pages/UnifiSites/UnifiSitesPage';

/** Full-screen loader shown while the auth session is being restored. */
function SplashScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-4">
        <img src="/momentia-logo-light.png" alt="" className="size-10 dark:hidden animate-pulse" />
        <img src="/momentia-logo-dark.png"  alt="" className="size-10 hidden dark:block animate-pulse" />
        <p className="text-sm text-text-muted">Loading…</p>
      </div>
    </div>
  );
}

function NoProfileError() {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="max-w-sm text-center space-y-3">
        <p className="text-lg font-semibold text-text-primary">Profile not found</p>
        <p className="text-sm text-text-muted">
          Your account exists but has no portal profile row. Run the INSERT in the Supabase
          SQL Editor (see console) or ask your administrator.
        </p>
        <button onClick={signOut} className="text-sm text-accent hover:underline">
          Sign out
        </button>
      </div>
    </div>
  );
}

/** Wraps every authenticated page — redirects to /login when there's no session. */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading)  return <SplashScreen />;
  if (!user)    return <Navigate to="/login" replace />;
  if (!profile) return <NoProfileError />;
  return <>{children}</>;
}

/** Redirects logged-in users away from /login back to the dashboard. */
function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  if (user)    return <Navigate to="/" replace />;
  return <>{children}</>;
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

function InnerRoutes() {
  return (
    <Routes>
      <Route path="/"              element={<DashboardPage />} />
      <Route path="/customers"         element={<CustomersPage />} />
      <Route path="/customers/:id"    element={<CustomerDetailPage />} />
      <Route path="/support"       element={<SupportPage />} />
      <Route path="/logs"          element={<LogsPage />} />
      <Route path="/backup"        element={<BackupPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/settings"      element={<SettingsPage />} />
      <Route path="/users"         element={<UsersPage />} />
      <Route path="/unifi-sites"   element={<UnifiSitesPage />} />
      <Route path="*"              element={<NotFound />} />
    </Routes>
  );
}

function AppRouter() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <InnerRoutes />
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppProvider>
            <AppRouter />
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
