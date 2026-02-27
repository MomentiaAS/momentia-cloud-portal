import { useState } from 'react';
import { ExternalLink, Rss } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { demoNews } from '../../../data/demo';
import { cn } from '../../../components/ui/cn';
import { formatDistanceToNow } from 'date-fns';

const ALL_CATEGORIES = ['All', ...Array.from(new Set(demoNews.map(n => n.category)))];

export function NewsWidget({ className }: { className?: string }) {
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = activeCategory === 'All'
    ? demoNews
    : demoNews.filter(n => n.category === activeCategory);

  return (
    <Card className={cn(className)}>
      <CardHeader
        title="Tech News"
        subtitle="MSP industry & security feed"
        action={<Rss className="size-4 text-accent" />}
      />
      <CardBody>
        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {ALL_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                cat === activeCategory
                  ? 'bg-accent text-white'
                  : 'bg-primary-100 dark:bg-primary-700 text-text-secondary hover:bg-primary-200 dark:hover:bg-primary-600',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* News list */}
        <ul className="space-y-2.5">
          {filtered.map(item => (
            <li key={item.id} className="group">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 p-2 -mx-2 rounded-lg hover:bg-surface transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <Badge variant="default">{item.category}</Badge>
                    <span className="text-[11px] text-text-muted">{item.source}</span>
                    <span className="text-[11px] text-text-muted">·</span>
                    <span className="text-[11px] text-text-muted">
                      {formatDistanceToNow(new Date(item.pubDate), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-text-primary leading-snug group-hover:text-accent transition-colors">
                    {item.title}
                  </p>
                </div>
                <ExternalLink className="size-3.5 shrink-0 text-text-muted mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
