import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../components/ui/cn';

export function LoginPage() {
  const { signIn } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [busy,        setBusy]        = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Check your credentials.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface text-text-primary">
      {/* Theme toggle — top right */}
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-primary-100 dark:hover:bg-primary-700/40 transition-colors focus-ring"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>

      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-8">

          {/* Logo + heading */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <img
                src="/momentia-logo-light.png"
                alt="Momentia"
                className="size-10 dark:hidden"
              />
              <img
                src="/momentia-logo-dark.png"
                alt="Momentia"
                className="size-10 hidden dark:block"
              />
              <span className="text-2xl font-bold text-text-primary tracking-tight">
                Moment<span className="text-accent">ia</span>
              </span>
            </div>
            <p className="text-sm text-text-muted">Cloud Portal — sign in to continue</p>
          </div>

          {/* Form card */}
          <div className="bg-surface-raised border border-border rounded-card shadow-card p-8 space-y-5">
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5">
                <AlertCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={cn(
                    'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary',
                    'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent',
                    'transition-colors',
                  )}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={cn(
                      'h-10 w-full rounded-lg border border-border bg-surface pl-3 pr-10 text-sm text-text-primary',
                      'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent',
                      'transition-colors',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || !email || !password}
                className={cn(
                  'w-full h-10 rounded-lg text-sm font-semibold transition-colors',
                  'bg-accent text-white hover:bg-accent-600',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'focus-ring',
                )}
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-text-muted">
            Contact your administrator if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}
