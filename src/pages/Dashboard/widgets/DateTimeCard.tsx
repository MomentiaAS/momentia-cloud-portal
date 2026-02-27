import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Card, CardBody } from '../../../components/ui/Card';
import { cn } from '../../../components/ui/cn';

function pad(n: number) { return String(n).padStart(2, '0'); }

export function DateTimeCard({ className }: { className?: string }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const day   = now.toLocaleDateString('en-AU', { weekday: 'long' });
  const date  = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const hh    = pad(now.getHours());
  const mm    = pad(now.getMinutes());
  const ss    = pad(now.getSeconds());

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardBody className="pt-5 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-text-muted mb-1">
          <Clock className="size-3.5" />
          <span className="text-xs font-medium uppercase tracking-wider">Local Time</span>
        </div>
        <div className="font-bold text-text-primary tabular-nums" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}>
          {hh}:{mm}
          <span className="text-text-muted text-xl">:{ss}</span>
        </div>
        <p className="text-sm text-text-secondary">{day}</p>
        <p className="text-xs text-text-muted">{date}</p>
      </CardBody>
    </Card>
  );
}
