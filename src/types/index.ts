// ── Core domain types ────────────────────────────────────────────────────────

export type CustomerStatus = 'active' | 'potential' | 'archived';
export type HealthStatus   = 'healthy' | 'degraded' | 'critical' | 'unknown';
export type Severity       = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ServiceTier    = 'basic' | 'pro' | 'advanced';

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
  state?:       string;
  notes?:       string;
  integrations: {
    veeam:      boolean;
    rmm:        boolean;
    m365:       boolean;
    azure:      boolean;
    sentinelOne: boolean;
    unifi:      boolean;
  };
  unifiSiteId?: string;
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

export type AssetType   = 'computer' | 'server' | 'network' | 'mobile' | 'printer' | 'license' | 'other';
export type AssetStatus = 'active' | 'retired' | 'spare';

export interface Asset {
  id:           string;
  customerId:   string;
  name:         string;
  type:         AssetType;
  make?:        string;
  model?:       string;
  serial?:      string;
  os?:          string;
  assignedTo?:  string;
  ipAddress?:   string;
  macAddress?:  string;
  location?:    string;
  status:       AssetStatus;
  purchaseDate?: string;   // ISO date string (date only)
  warrantyEnd?:  string;   // ISO date string (date only)
  notes?:       string;
  createdAt:    string;
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
