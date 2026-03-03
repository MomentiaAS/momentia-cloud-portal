/**
 * RSS Feed Edge Function
 *
 * Fetches several MSP/security RSS feeds server-side (no CORS issues),
 * parses them, and returns a unified array of news items sorted by date.
 *
 * Called via POST from the frontend; no body parameters required.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

// ── Feed sources ──────────────────────────────────────────────────────────────

const FEEDS = [
  { url: 'https://www.bleepingcomputer.com/feed/',          source: 'Bleeping Computer', category: 'Security' },
  { url: 'https://feeds.feedburner.com/TheHackersNews',     source: 'The Hacker News',   category: 'Security' },
  { url: 'https://krebsonsecurity.com/feed/',               source: 'Krebs on Security', category: 'Security' },
  { url: 'https://feeds.arstechnica.com/arstechnica/index', source: 'Ars Technica',      category: 'Tech'     },
  { url: 'https://www.theregister.com/security/headlines.atom', source: 'The Register',  category: 'Security' },
];

// ── XML helpers ───────────────────────────────────────────────────────────────

/** Extract text content between the first matching open/close tag pair. */
function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m  = xml.match(re);
  return m ? stripCdata(m[1].trim()) : '';
}

/** For Atom feeds, extract href from <link> element. */
function extractLink(xml: string): string {
  // Atom: <link href="..." rel="alternate" .../>
  const atom = xml.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  if (atom) return atom[1];
  // RSS: <link>https://...</link>
  const rss = xml.match(/<link>([^<]+)<\/link>/i);
  return rss ? rss[1].trim() : '';
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

// ── Parse a single feed ───────────────────────────────────────────────────────

interface NewsItem {
  id:       string;
  title:    string;
  url:      string;
  source:   string;
  category: string;
  pubDate:  string;
  excerpt:  string;
}

function parseFeed(xml: string, source: string, category: string): NewsItem[] {
  // Split on <item> (RSS) or <entry> (Atom)
  const itemTag   = xml.includes('<entry') ? 'entry' : 'item';
  const itemRegex = new RegExp(`<${itemTag}[\\s>][\\s\\S]*?<\\/${itemTag}>`, 'gi');
  const rawItems  = xml.match(itemRegex) ?? [];

  return rawItems.slice(0, 8).flatMap((raw, i) => {
    const title   = stripHtml(extractTag(raw, 'title'));
    const url     = extractLink(raw) || extractTag(raw, 'link');
    const pubDate = extractTag(raw, 'pubDate') || extractTag(raw, 'published') || extractTag(raw, 'updated');
    const excerpt = stripHtml(extractTag(raw, 'description') || extractTag(raw, 'summary') || extractTag(raw, 'content')).slice(0, 200);

    if (!title || !url) return [];

    let isoDate: string;
    try {
      isoDate = new Date(pubDate).toISOString();
    } catch {
      isoDate = new Date().toISOString();
    }

    return [{
      id:       `${source}-${i}-${isoDate}`,
      title,
      url,
      source,
      category,
      pubDate:  isoDate,
      excerpt,
    }];
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const results = await Promise.allSettled(
      FEEDS.map(async (feed) => {
        const res = await fetch(feed.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MomentiaPortal/1.0)' },
          signal:  AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        return parseFeed(xml, feed.source, feed.category);
      }),
    );

    const items: NewsItem[] = results
      .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 30);

    return new Response(JSON.stringify({ items, fetchedAt: new Date().toISOString() }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status:  500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
