import { ExternalLink, BookOpen, Ticket } from 'lucide-react';
import {
  Database, LayoutGrid, Cloud, Shield, Monitor, BellRing,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { demoKbArticles, demoSupportLinks } from '../../data/demo';
import { formatDistanceToNow } from 'date-fns';

const ICON_MAP: Record<string, React.ElementType> = {
  database:     Database,
  'layout-grid': LayoutGrid,
  cloud:        Cloud,
  shield:       Shield,
  monitor:      Monitor,
  'bell-ring':  BellRing,
};

export function SupportPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Support</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Quick links, knowledge base, and ticket integrations.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Quick Links */}
        <Card className="lg:col-span-1">
          <CardHeader title="Quick Links" subtitle="Vendor portals & tools" />
          <CardBody>
            <ul className="space-y-1">
              {demoSupportLinks.map(link => {
                const Icon = ICON_MAP[link.icon] ?? ExternalLink;
                return (
                  <li key={link.label}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface transition-colors group"
                    >
                      <Icon className="size-4 text-accent shrink-0" />
                      <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors flex-1">
                        {link.label}
                      </span>
                      <ExternalLink className="size-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        {/* Knowledge Base */}
        <Card className="lg:col-span-2">
          <CardHeader title="Knowledge Base" subtitle="Internal articles & runbooks" action={<BookOpen className="size-4 text-text-muted" />} />
          <CardBody>
            <ul className="space-y-3">
              {demoKbArticles.map(article => (
                <li key={article.id}>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col gap-1 p-3 rounded-lg border border-border hover:border-accent/30 hover:bg-surface transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="info">{article.category}</Badge>
                        <span className="text-xs text-text-muted">
                          Updated {formatDistanceToNow(new Date(article.updatedAt), { addSuffix: true })}
                        </span>
                      </div>
                      <ExternalLink className="size-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                    <p className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                      {article.title}
                    </p>
                    <p className="text-xs text-text-muted leading-relaxed">{article.excerpt}</p>
                  </a>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        {/* Ticket System Placeholder */}
        <Card className="lg:col-span-3">
          <CardBody className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="size-12 rounded-xl bg-primary-100 dark:bg-primary-700 flex items-center justify-center">
              <Ticket className="size-6 text-text-muted" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Ticketing System — Coming Soon</p>
              <p className="text-xs text-text-muted mt-1 max-w-xs">
                Integration with ConnectWise Manage, Halo PSA, or your preferred ticketing platform will appear here.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
