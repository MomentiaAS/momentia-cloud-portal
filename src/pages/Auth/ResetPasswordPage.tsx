import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { supabase } from '../../lib/supabase';

function getRecoveryTokensFromHash() {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const type = params.get('type');
  return { access_token, refresh_token, type };
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);

  const [recoveryReady, setRecoveryReady] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSaved, setUpdateSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function bootstrapRecovery() {
      const { access_token, refresh_token, type } = getRecoveryTokensFromHash();
      if (!access_token || !refresh_token || type !== 'recovery') return;
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (!mounted) return;
      if (!error) {
        setRecoveryReady(true);
        // Keep URL clean so refreshing won't re-parse tokens.
        window.history.replaceState({}, document.title, '/reset-password');
      }
    }
    void bootstrapRecovery();
    return () => { mounted = false; };
  }, []);

  const canSubmitUpdate = useMemo(() => {
    return newPassword.length >= 8 && confirmPassword.length >= 8 && newPassword === confirmPassword;
  }, [newPassword, confirmPassword]);

  async function sendResetEmail(e: FormEvent) {
    e.preventDefault();
    const next = email.trim().toLowerCase();
    if (!next) return;
    setRequestBusy(true);
    setRequestError(null);
    setRequestSent(false);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(next, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setRequestSent(true);
      setTimeout(() => {
        navigate('/login?reset=sent', { replace: true });
      }, 900);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Failed to send reset email.');
    } finally {
      setRequestBusy(false);
    }
  }

  async function updatePassword(e: FormEvent) {
    e.preventDefault();
    if (!canSubmitUpdate) return;
    setUpdateBusy(true);
    setUpdateError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setUpdateSaved(true);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setUpdateBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-surface text-text-primary">
      <div className="w-full max-w-sm bg-surface-raised border border-border rounded-card shadow-card p-7 space-y-5">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-text-primary">Reset password</h1>
          <p className="text-sm text-text-muted">
            {recoveryReady
              ? 'Set your new password below.'
              : 'Enter your email to receive a reset link.'}
          </p>
        </div>

        {recoveryReady ? (
          <form onSubmit={updatePassword} className="space-y-4" noValidate>
            {updateError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5">
                <AlertCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-600 dark:text-red-400">{updateError}</p>
              </div>
            )}
            {updateSaved && (
              <div className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2.5">
                <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-sm text-emerald-600 dark:text-emerald-400">Password updated. You can now sign in.</p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-password" className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
                className={cn(
                  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary',
                  'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent',
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-password" className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
                className={cn(
                  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary',
                  'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent',
                )}
              />
            </div>

            <button
              type="submit"
              disabled={updateBusy || !canSubmitUpdate}
              className={cn(
                'w-full h-10 rounded-lg text-sm font-semibold transition-colors',
                'bg-accent text-white hover:bg-accent-600',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {updateBusy ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        ) : (
          <form onSubmit={sendResetEmail} className="space-y-4" noValidate>
            {requestError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5">
                <AlertCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-600 dark:text-red-400">{requestError}</p>
              </div>
            )}
            {requestSent && (
              <div className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2.5">
                <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-sm text-emerald-600 dark:text-emerald-400">Reset link sent. Check your inbox.</p>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reset-email" className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
                className={cn(
                  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary',
                  'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent',
                )}
              />
            </div>
            <button
              type="submit"
              disabled={requestBusy || !email.trim()}
              className={cn(
                'w-full h-10 rounded-lg text-sm font-semibold transition-colors',
                'bg-accent text-white hover:bg-accent-600',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {requestBusy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="text-xs text-text-muted text-center">
          <Link to="/login" className="text-accent hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

