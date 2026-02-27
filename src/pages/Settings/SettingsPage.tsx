import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Avatar } from '../../components/ui/Avatar';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';

export function SettingsPage() {
  const { theme, toggleTheme }       = useTheme();
  const { user, weatherCity, setWeatherCity } = useApp();
  const [cityDraft, setCityDraft]    = useState(weatherCity);
  const [citySaved, setCitySaved]    = useState(false);

  function saveCity() {
    if (cityDraft.trim()) {
      setWeatherCity(cityDraft.trim());
      setCitySaved(true);
      setTimeout(() => setCitySaved(false), 2000);
    }
  }

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
            <Avatar name={user.name} size="lg" />
            <div>
              <p className="text-sm font-semibold text-text-primary">{user.name}</p>
              <p className="text-xs text-text-muted">{user.role}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Full Name" defaultValue={user.name} />
            <Input label="Email" type="email" defaultValue={user.email} />
            <Input label="Role" defaultValue={user.role} />
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" size="sm">Save Profile</Button>
          </div>
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
        <CardBody>
          <div className="flex flex-col gap-3">
            <Input
              label="Weather Location"
              leftIcon={<MapPin className="size-3.5" />}
              value={cityDraft}
              onChange={e => { setCityDraft(e.target.value); setCitySaved(false); }}
              onKeyDown={e => e.key === 'Enter' && saveCity()}
              placeholder="e.g. Melbourne"
              hint="City name shown on the dashboard weather card."
            />
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={saveCity}>
                {citySaved ? 'Saved!' : 'Save Location'}
              </Button>
              {citySaved && (
                <span className="text-xs text-emerald-500">Location updated on dashboard.</span>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Portal Config */}
      <Card>
        <CardHeader title="Portal Configuration" subtitle="Organisation-wide defaults" />
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Organisation Name" defaultValue="Momentia" />
            <Input label="Default Timezone" defaultValue="Australia/Sydney" />
            <Select label="Default Date Range">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>This month</option>
            </Select>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" size="sm">Save Settings</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
