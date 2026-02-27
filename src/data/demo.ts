/**
 * Static configuration used by UI widgets.
 *
 * Customers, alerts, logs, and backup jobs are now stored in Supabase.
 * This file only contains data that has no database equivalent:
 *   - weather widget defaults
 *   - news feed placeholders
 *   - support / KB links
 *   - current user profile
 */

import type { NewsItem, KbArticle, SupportLink } from '../types';

// ── RSS / News ───────────────────────────────────────────────────────────────

export const demoNews: NewsItem[] = [
  {
    id: 'news-001',
    title: 'Microsoft patches critical NTLM relay vulnerability in February Patch Tuesday',
    source: 'Bleeping Computer',
    url: '#',
    category: 'Security',
    pubDate: '2026-02-25T14:00:00Z',
  },
  {
    id: 'news-002',
    title: 'Veeam releases v13 with native Kubernetes backup support',
    source: 'Veeam Blog',
    url: '#',
    category: 'Backup',
    pubDate: '2026-02-24T09:00:00Z',
  },
  {
    id: 'news-003',
    title: 'Azure outage in Australia East affects 200+ services for 2 hours',
    source: 'The Register',
    url: '#',
    category: 'Cloud',
    pubDate: '2026-02-23T18:30:00Z',
  },
  {
    id: 'news-004',
    title: 'New ransomware campaign targets SMBs via unpatched Fortinet VPNs',
    source: 'CSOOnline',
    url: '#',
    category: 'Security',
    pubDate: '2026-02-22T10:00:00Z',
  },
  {
    id: 'news-005',
    title: 'ConnectWise RMM now integrates with Microsoft Entra ID',
    source: 'ConnectWise Blog',
    url: '#',
    category: 'RMM',
    pubDate: '2026-02-21T08:00:00Z',
  },
  {
    id: 'news-006',
    title: 'SentinelOne expands XDR platform with email threat protection',
    source: 'SentinelOne Blog',
    url: '#',
    category: 'Security',
    pubDate: '2026-02-20T12:00:00Z',
  },
  {
    id: 'news-007',
    title: 'ACSC releases updated Essential Eight maturity model for 2026',
    source: 'ACSC',
    url: '#',
    category: 'Compliance',
    pubDate: '2026-02-19T07:00:00Z',
  },
];

// ── Knowledge Base ───────────────────────────────────────────────────────────

export const demoKbArticles: KbArticle[] = [
  {
    id: 'kb-001',
    title: 'How to add a new customer and onboard integrations',
    excerpt: 'Step-by-step guide for creating a customer record, configuring RMM, and enabling backup.',
    category: 'Onboarding',
    updatedAt: '2026-01-15T00:00:00Z',
    url: '#',
  },
  {
    id: 'kb-002',
    title: 'Veeam job failure: common causes and remediation',
    excerpt: 'Covers repository issues, snapshot quiescence errors, and network connectivity problems.',
    category: 'Backup',
    updatedAt: '2026-02-10T00:00:00Z',
    url: '#',
  },
  {
    id: 'kb-003',
    title: 'M365 MFA enforcement best practices for SMBs',
    excerpt: 'How to audit, remediate, and enforce MFA for Microsoft 365 tenants.',
    category: 'M365 / Security',
    updatedAt: '2026-02-01T00:00:00Z',
    url: '#',
  },
  {
    id: 'kb-004',
    title: 'Essential Eight baseline configuration checklist',
    excerpt: 'Internal checklist aligned to ACSC Essential Eight for client environments.',
    category: 'Compliance',
    updatedAt: '2026-02-19T00:00:00Z',
    url: '#',
  },
];

export const demoSupportLinks: SupportLink[] = [
  { label: 'Veeam Support Portal',         url: 'https://www.veeam.com/support.html',    icon: 'database' },
  { label: 'Microsoft 365 Admin Center',   url: 'https://admin.microsoft.com',            icon: 'layout-grid' },
  { label: 'Azure Portal',                 url: 'https://portal.azure.com',               icon: 'cloud' },
  { label: 'SentinelOne Console',          url: '#',                                      icon: 'shield' },
  { label: 'ConnectWise RMM',              url: '#',                                      icon: 'monitor' },
  { label: 'ACSC Alerts & Advisories',     url: 'https://www.cyber.gov.au/about-us/view-all-content/alerts-and-advisories', icon: 'bell-ring' },
];

// ── Weather (static placeholder) ─────────────────────────────────────────────

export const demoWeather = {
  city: 'Sydney',
  condition: 'Partly Cloudy',
  tempC: 24,
  humidity: 62,
  windKph: 18,
  icon: '⛅',
};

// ── Auth user ────────────────────────────────────────────────────────────────

export const demoUser = {
  name:   'Alice Hartman',
  role:   'Senior Engineer',
  email:  'alice@momentia.com.au',
  avatar: null as string | null,
};
