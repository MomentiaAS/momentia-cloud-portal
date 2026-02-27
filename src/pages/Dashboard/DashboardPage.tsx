import { useApp } from '../../context/AppContext';
import { DateTimeCard }          from './widgets/DateTimeCard';
import { WeatherCard }           from './widgets/WeatherCard';
import { EnvironmentStatusCard } from './widgets/EnvironmentStatusCard';
import { CriticalAlertsCard }    from './widgets/CriticalAlertsCard';
import { CustomerOverviewCard }  from './widgets/CustomerOverviewCard';
import { NewsWidget }            from './widgets/NewsWidget';

export function DashboardPage() {
  const { user } = useApp();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Welcome back, {user.name.split(' ')[0]}
        </h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Here's your operational overview for today.
        </p>
      </div>

      {/* Widget grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {/* Row 1: small info cards */}
        <DateTimeCard         className="sm:col-span-1" />
        <WeatherCard          className="sm:col-span-1" />
        <EnvironmentStatusCard className="sm:col-span-2" />

        {/* Row 2: larger widgets */}
        <CriticalAlertsCard   className="sm:col-span-2" />
        <CustomerOverviewCard className="sm:col-span-2 xl:col-span-1" />
        <NewsWidget           className="sm:col-span-2 xl:col-span-3" />
      </div>
    </div>
  );
}
