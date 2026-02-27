// ── Core domain types ────────────────────────────────────────────────────────

export type CustomerStatus = 'active' | 'potential' | 'archived';
export type HealthStatus   = 'healthy' | 'degraded' | 'critical' | 'unknown';
export type Severity       = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ServiceTier    = 'basic' | 'standard' | 'premium' | 'enterprise';

export interface Contact {
  name:  string;
  email: string;
  phone?: string;
  role?:  string;
}

export interface Customer {
  id:           string;
  name:         string;
  status:       CustomerStatus;
  health:       HealthStatus;
  tier:         ServiceTier;
  openAlerts:   number;
  lastSync:     string;          // ISO date string
  assignedTech: string;
  primaryContact: Contact;
  billingContact?: Contact;
  domain?:      string;
  address?:     string;
  notes?:       string;
  integrations: {
    veeam:      boolean;
    rmm:        boolean;
    m365:       boolean;
    azure:      boolean;
    sentinelOne: boolean;
  };
  createdAt: string;
}

export interface Alert {
  id:         string;
  customerId: string;
  title:      string;
  message:    string;
  severity:   Severity;
  timestamp:  string;
  resolved:   boolean;
  source:     string;
}

export interface LogEntry {
  id:         string;
  customerId?: string;
  system:     string;
  severity:   Severity;
  message:    string;
  details?:   string;
  timestamp:  string;
}

export interface BackupJob {
  id:           string;
  customerId:   string;
  jobName:      string;
  status:       'success' | 'warning' | 'failed' | 'running' | 'idle';
  lastRun:      string;
  nextRun?:     string;
  duration?:    number; // minutes
  sizeGb?:      number;
  dataSource:   string;
  repository:   string;
  retentionDays: number;
  errorMessage?: string;
}

export interface NewsItem {
  id:       string;
  title:    string;
  source:   string;
  url:      string;
  category: string;
  pubDate:  string;
}

export interface KbArticle {
  id:       string;
  title:    string;
  excerpt:  string;
  category: string;
  updatedAt: string;
  url:      string;
}

export interface SupportLink {
  label: string;
  url:   string;
  icon:  string;
}
