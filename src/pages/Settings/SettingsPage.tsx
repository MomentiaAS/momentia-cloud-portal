import { useState, useEffect, useCallback, useRef } from 'react';
import { Save, MapPin, Loader2, X, Clock, Upload, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Avatar } from '../../components/ui/Avatar';
import { cn } from '../../components/ui/cn';
import { useTheme } from '../../context/ThemeContext';
import { useApp, type WeatherLocation } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { removeAvatarForUser, uploadAvatarForUser } from '../../lib/avatars';
import { searchCities, type GeoSuggestion } from '../../hooks/useWeather';

// ── Shared input style ────────────────────────────────────────────────────────

const inputClass = cn(
  'h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary',
  'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent',
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
);

// ── City autocomplete field ───────────────────────────────────────────────────

function CitySearchField({
  value,
  onSelect,
}: {
  value: WeatherLocation;
  onSelect: (loc: WeatherLocation) => void;
}) {
  const [query,       setQuery]       = useState('');
  const [open,        setOpen]        = useState(false);
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(-1);
  const [searchErr,   setSearchErr]   = useState('');

  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setSuggestions([]); setSearchErr(''); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchErr('');
      try {
        const results = await searchCities(q);
        setSuggestions(results);
        setActiveIdx(-1);
        if (results.length === 0) setSearchErr('No locations found');
      } catch {
        setSearchErr('Search failed');
      } finally {
        setSearching(false);
      }
    }, 350);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setOpen(true);
    doSearch(e.target.value);
  }

  function handleSelect(s: GeoSuggestion) {
    onSelect(s);
    setQuery('');
    setSuggestions([]);
    setOpen(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); handleSelect(suggestions[activeIdx]); }
  }

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current    && !inputRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
        Weather Location
      </label>

      {/* Current selection */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface/50 text-sm text-text-primary">
        <MapPin className="size-3.5 text-text-muted shrink-0" />
        <span className="flex-1 truncate">{value.label}</span>
      </div>

      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={handleInput}
            onKeyDown={handleKey}
            onFocus={() => setOpen(true)}
            placeholder="Search for a new location…"
            className={cn(inputClass, 'pl-8 pr-8')}
          />
          <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-muted pointer-events-none" />
          {searching && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-muted animate-spin" />
          )}
          {query && !searching && (
            <button
              type="button"
              onClick={() => { setQuery(''); setSuggestions([]); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {open && (suggestions.length > 0 || searchErr) && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-border bg-surface shadow-lg overflow-hidden"
            role="listbox"
          >
            {searchErr && <p className="px-3 py-2 text-xs text-text-muted">{searchErr}</p>}
            {suggestions.map((s, i) => (
              <button
                key={`${s.lat}-${s.lon}`}
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
                onMouseEnter={() => setActiveIdx(i)}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors',
                  i === activeIdx ? 'bg-accent/10 text-text-primary' : 'text-text-secondary hover:bg-surface-raised',
                  i > 0 && 'border-t border-border/50',
                )}
              >
                <MapPin className="size-3 text-text-muted shrink-0" />
                <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-text-muted">Shown on the dashboard weather widget.</p>
    </div>
  );
}

// ── Timezone search field ─────────────────────────────────────────────────────

const ALL_TIMEZONES: string[] = Intl.supportedValuesOf('timeZone');

function TimezoneSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (tz: string) => void;
}) {
  const [query,     setQuery]     = useState('');
  const [open,      setOpen]      = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim().length < 1
    ? ALL_TIMEZONES.slice(0, 8)
    : ALL_TIMEZONES.filter(tz =>
        tz.toLowerCase().includes(query.toLowerCase()) ||
        // also match city part after last slash: "Sydney" matches "Australia/Sydney"
        tz.split('/').pop()!.toLowerCase().replace(/_/g, ' ').includes(query.toLowerCase()),
      ).slice(0, 50);

  function handleSelect(tz: string) {
    onChange(tz);
    setQuery('');
    setOpen(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (filtered.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); handleSelect(filtered[activeIdx]); }
  }

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current    && !inputRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  function formatTz(tz: string) {
    const city = tz.split('/').pop()!.replace(/_/g, ' ');
    const region = tz.includes('/') ? tz.split('/').slice(0, -1).join('/') : '';
    return { city, region };
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
        Default Timezone
      </label>

      {/* Current selection */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface/50 text-sm text-text-primary">
        <Clock className="size-3.5 text-text-muted shrink-0" />
        <span className="flex-1 truncate">{value}</span>
      </div>

      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(-1); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKey}
            placeholder="Search timezone or city…"
            className={cn(inputClass, 'pl-8 pr-8')}
          />
          <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-muted pointer-events-none" />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setOpen(false); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {open && filtered.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-border bg-surface shadow-lg overflow-hidden max-h-52 overflow-y-auto"
            role="listbox"
          >
            {filtered.map((tz, i) => {
              const { city, region } = formatTz(tz);
              return (
                <button
                  key={tz}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseDown={e => { e.preventDefault(); handleSelect(tz); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors',
                    i === activeIdx ? 'bg-accent/10 text-text-primary' : 'text-text-secondary hover:bg-surface-raised',
                    i > 0 && 'border-t border-border/50',
                  )}
                >
                  <Clock className="size-3 text-text-muted shrink-0" />
                  <span className="font-medium text-text-primary">{city}</span>
                  {region && <span className="text-text-muted truncate">{region}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <p className="text-xs text-text-muted">Used for date/time display across the portal.</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TZ_KEY = 'momentia-timezone';

export function SettingsPage() {
  const { theme, toggleTheme }                   = useTheme();
  const { weatherLocation, setWeatherLocation }  = useApp();
  const { user, profile }                        = useAuth();

  const [locationSaved, setLocationSaved] = useState(false);
  const [pendingLoc, setPendingLoc]       = useState<WeatherLocation | null>(null);

  const [timezone, setTimezone] = useState<string>(
    () => localStorage.getItem(TZ_KEY) ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [timezoneSaved, setTimezoneSaved] = useState(false);

  const [nameDraft,    setNameDraft]    = useState(profile?.name ?? '');
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileBusy,  setProfileBusy]  = useState(false);
  const [avatarBusy,   setAvatarBusy]   = useState(false);
  const [avatarError,  setAvatarError]  = useState<string | null>(null);
  const [emailDraft,   setEmailDraft]   = useState(profile?.email ?? '');
  const [emailBusy,    setEmailBusy]    = useState(false);
  const [emailSaved,   setEmailSaved]   = useState(false);
  const [emailError,   setEmailError]   = useState<string | null>(null);
  const [emailInfo,    setEmailInfo]    = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy,    setPasswordBusy]    = useState(false);
  const [passwordSaved,   setPasswordSaved]   = useState(false);
  const [passwordError,   setPasswordError]   = useState<string | null>(null);

  useEffect(() => {
    setNameDraft(profile?.name ?? '');
    setEmailDraft(profile?.email ?? user?.email ?? '');
  }, [profile?.id, profile?.name, profile?.email, user?.email]);

  function handleLocationSelect(loc: WeatherLocation) {
    setPendingLoc(loc);
    setLocationSaved(false);
  }

  function saveLocation() {
    if (!pendingLoc) return;
    setWeatherLocation(pendingLoc);
    setLocationSaved(true);
    setPendingLoc(null);
    setTimeout(() => setLocationSaved(false), 2000);
  }

  function handleTimezoneChange(tz: string) {
    setTimezone(tz);
    setTimezoneSaved(false);
  }

  function saveTimezone() {
    localStorage.setItem(TZ_KEY, timezone);
    setTimezoneSaved(true);
    setTimeout(() => setTimezoneSaved(false), 2000);
  }

  async function saveProfile() {
    if (!profile) return;
    setProfileBusy(true);
    setProfileError(null);
    const { error } = await supabase
      .from('profiles')
      .update({ name: nameDraft.trim() || null })
      .eq('id', profile.id);
    if (error) {
      setProfileError(error.message);
    } else {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    }
    setProfileBusy(false);
  }

  async function handleAvatarUpload(file: File) {
    if (!profile) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const { publicUrl } = await uploadAvatarForUser({ userId: profile.id, file });
      // Cache-bust for immediate UI refresh
      const urlWithBust = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: urlWithBust })
        .eq('id', profile.id);
      if (error) throw new Error(error.message);
      window.dispatchEvent(new Event('profile-updated'));
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : 'Failed to upload photo.');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarRemove() {
    if (!profile) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      await removeAvatarForUser(profile.id);
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', profile.id);
      if (error) throw new Error(error.message);
      window.dispatchEvent(new Event('profile-updated'));
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : 'Failed to remove photo.');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function saveEmail() {
    if (!user) return;
    const nextEmail = emailDraft.trim().toLowerCase();
    const currentEmail = (user.email ?? profile?.email ?? '').toLowerCase();
    if (!nextEmail || nextEmail === currentEmail) return;
    if (!/\S+@\S+\.\S+/.test(nextEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setEmailBusy(true);
    setEmailError(null);
    setEmailInfo(null);
    try {
      const { error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) throw error;
      setEmailSaved(true);
      setEmailInfo('Email update requested. Check your inbox for a confirmation link.');
      setTimeout(() => setEmailSaved(false), 2500);
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : 'Failed to update email.');
    } finally {
      setEmailBusy(false);
    }
  }

  async function savePassword() {
    if (!user) return;
    const loginEmail = user.email ?? profile?.email ?? '';
    if (!loginEmail) {
      setPasswordError('Current email is unavailable for verification.');
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setPasswordBusy(true);
    setPasswordError(null);
    try {
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: currentPassword,
      });
      if (verifyErr) throw new Error('Current password is incorrect.');

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setPasswordSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSaved(false), 2500);
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Failed to update password.');
    } finally {
      setPasswordBusy(false);
    }
  }

  const displayName = profile?.name ?? profile?.email ?? 'User';
  const roleLabel   = profile?.role
    ? { superadmin: 'Super Admin', admin: 'Admin', technician: 'Technician', viewer: 'Customer' }[profile.role] ?? profile.role
    : '—';

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-0.5">Manage your profile and application preferences.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader title="Profile" subtitle="Your personal details" />
        <CardBody>
          <div className="flex items-center gap-4 mb-5">
            <Avatar name={displayName} size="lg" src={profile?.avatar_url ?? null} />
            <div>
              <p className="text-sm font-semibold text-text-primary">{displayName}</p>
              <p className="text-xs text-text-muted">{roleLabel}</p>
              <div className="mt-2 flex items-center gap-2">
                <label className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-medium',
                  'text-accent hover:text-accent/80 cursor-pointer',
                  avatarBusy && 'opacity-60 pointer-events-none',
                )}>
                  <Upload className="size-3.5" />
                  Upload photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) void handleAvatarUpload(f);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
                {profile?.avatar_url && (
                  <button
                    type="button"
                    onClick={() => void handleAvatarRemove()}
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-medium',
                      'text-red-500 hover:text-red-600',
                      avatarBusy && 'opacity-60 pointer-events-none',
                    )}
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </button>
                )}
              </div>
              {avatarError && <p className="mt-1 text-xs text-red-500">{avatarError}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Name"
              value={nameDraft}
              onChange={e => { setNameDraft(e.target.value); setProfileSaved(false); }}
            />
            <Input label="Email" type="email" value={user?.email ?? profile?.email ?? ''} disabled />
            <Input label="Role" value={roleLabel} disabled />
          </div>
          {profileError && <p className="mt-2 text-xs text-red-500">{profileError}</p>}
          <div className="mt-4 flex items-center gap-2 justify-end">
            {profileSaved && <span className="text-xs text-emerald-500">Saved!</span>}
            <Button variant="primary" size="sm" onClick={saveProfile} disabled={profileBusy}>
              <Save className="size-3.5" />
              {profileBusy ? 'Saving…' : 'Save Profile'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader title="Security" subtitle="Change login email and password" />
        <CardBody className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Email</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Login Email"
                type="email"
                value={emailDraft}
                onChange={e => { setEmailDraft(e.target.value); setEmailSaved(false); setEmailError(null); }}
              />
            </div>
            {emailError && <p className="text-xs text-red-500">{emailError}</p>}
            {emailInfo && <p className="text-xs text-text-muted">{emailInfo}</p>}
            <div className="flex items-center gap-2 justify-end">
              {emailSaved && <span className="text-xs text-emerald-500">Saved!</span>}
              <Button
                variant="primary"
                size="sm"
                onClick={saveEmail}
                disabled={emailBusy || !emailDraft.trim() || emailDraft.trim().toLowerCase() === (user?.email ?? profile?.email ?? '').toLowerCase()}
              >
                {emailBusy ? 'Saving…' : 'Update Email'}
              </Button>
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Password</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Current Password"
                type="password"
                value={currentPassword}
                onChange={e => { setCurrentPassword(e.target.value); setPasswordSaved(false); setPasswordError(null); }}
              />
              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPasswordSaved(false); setPasswordError(null); }}
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPasswordSaved(false); setPasswordError(null); }}
              />
            </div>
            {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
            <div className="flex items-center gap-2 justify-end">
              {passwordSaved && <span className="text-xs text-emerald-500">Saved!</span>}
              <Button
                variant="primary"
                size="sm"
                onClick={savePassword}
                disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword}
              >
                {passwordBusy ? 'Saving…' : 'Update Password'}
              </Button>
            </div>
          </section>
        </CardBody>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader title="Appearance" subtitle="Theme and display preferences" />
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Colour Theme</p>
              <p className="text-xs text-text-muted mt-0.5">Currently: {theme === 'dark' ? 'Dark' : 'Light'}</p>
            </div>
            <Button variant="outline" onClick={toggleTheme}>
              Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Dashboard Widgets */}
      <Card>
        <CardHeader title="Dashboard Widgets" subtitle="Configure widget behaviour" />
        <CardBody className="space-y-4">
          <CitySearchField
            value={pendingLoc ?? weatherLocation}
            onSelect={handleLocationSelect}
          />
          {(pendingLoc || locationSaved) && (
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={saveLocation} disabled={!pendingLoc}>
                {locationSaved ? 'Saved!' : 'Save Location'}
              </Button>
              {locationSaved && <span className="text-xs text-emerald-500">Weather widget updated.</span>}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Portal Config */}
      <Card>
        <CardHeader title="Portal Configuration" subtitle="Organisation-wide defaults" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Organisation Name" defaultValue="Momentia" />
            <Select label="Default Date Range">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>This month</option>
            </Select>
          </div>
          <TimezoneSearchField value={timezone} onChange={handleTimezoneChange} />
          <div className="flex items-center gap-2 justify-end">
            {timezoneSaved && <span className="text-xs text-emerald-500">Saved!</span>}
            <Button variant="primary" size="sm" onClick={saveTimezone}>
              <Save className="size-3.5" />
              Save Settings
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
