import { useState } from 'react';
import { ExternalLink, Rss, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { cn } from '../../../components/ui/cn';
import { formatDistanceToNow } from 'date-fns';
import { useNews } from '../../../hooks/useNews';

export function NewsWidget({ className }: { className?: string }) {
  const { items, loading, error, lastFetched, refresh } = useNews();
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = ['All', ...Array.from(new Set(items.map(n => n.category)))];

  const filtered = activeCategory === 'All'
    ? items
    : items.filter(n => n.category === activeCategory);

  return (
    <Card className={cn(className)}>
      <CardHeader
        title="Tech News"
        subtitle={
          lastFetched
            ? `Updated ${formatDistanceToNow(lastFetched, { addSuffix: true })}`
            : 'MSP industry & security feed'
        }
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={loading}
              aria-label="Refresh news"
              className="text-text-muted hover:text-accent transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            </button>
            <Rss className="size-4 text-accent" />
          </div>
        }
      />
      <CardBody>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>Could not load feed — showing cached articles. {error}</span>
          </div>
        )}

        {/* Category filter pills */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {categories.map(cat => (
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
        )}

        {/* Loading skeletons */}
        {loading && items.length === 0 && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-1.5">
                <div className="flex gap-2">
                  <div className="h-4 w-16 rounded bg-surface-raised" />
                  <div className="h-4 w-24 rounded bg-surface-raised" />
                </div>
                <div className="h-3.5 w-full rounded bg-surface-raised" />
                <div className="h-3.5 w-4/5 rounded bg-surface-raised" />
              </div>
            ))}
          </div>
        )}

        {/* News list */}
        {filtered.length > 0 && (
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
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && !error && (
          <p className="text-sm text-text-muted text-center py-4">No articles found.</p>
        )}
      </CardBody>
    </Card>
  );
}
