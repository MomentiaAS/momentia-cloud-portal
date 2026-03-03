import { useState, useEffect, useCallback } from 'react';
import type { NewsItem } from '../types';

const CACHE_KEY    = 'momentia-news-cache';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  items:      NewsItem[];
  fetchedAt:  number;
}

function loadCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

function saveCache(items: NewsItem[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ items, fetchedAt: Date.now() }));
  } catch { /* ignore quota errors */ }
}

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rss-feed`;

export function useNews() {
  const [items,   setItems]   = useState<NewsItem[]>(() => loadCache()?.items ?? []);
  const [loading, setLoading] = useState(items.length === 0);
  const [error,   setError]   = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(
    () => { const c = loadCache(); return c ? new Date(c.fetchedAt) : null; },
  );

  const fetchNews = useCallback(async (force = false) => {
    if (!force) {
      const cached = loadCache();
      if (cached) {
        setItems(cached.items);
        setLastFetched(new Date(cached.fetchedAt));
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(EDGE_URL, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);

      // Map edge function response to NewsItem type
      const mapped: NewsItem[] = (json.items ?? []).map((r: {
        id: string; title: string; url: string; source: string;
        category: string; pubDate: string;
      }, idx: number) => ({
        id:      r.id ?? `news-${idx}`,
        title:   r.title,
        url:     r.url,
        source:  r.source,
        category: r.category,
        pubDate:  r.pubDate,
      }));

      saveCache(mapped);
      setItems(mapped);
      setLastFetched(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load news');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => { fetchNews(); }, [fetchNews]);

  // Refresh every hour while the tab is open
  useEffect(() => {
    const timer = setInterval(() => fetchNews(true), CACHE_TTL_MS);
    return () => clearInterval(timer);
  }, [fetchNews]);

  return { items, loading, error, lastFetched, refresh: () => fetchNews(true) };
}
