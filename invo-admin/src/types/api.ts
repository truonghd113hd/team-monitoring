// API Types
export interface Project {
  _id: string;
  name: string;
  description: string;
  googleSheetUrl: string;
  status: 'active' | 'inactive' | 'archived';
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  stats?: {
    filesCount: number;
    issuesCount: number;
    pendingIssues: number;
  };
}

export interface File {
  _id: string;
  projectId: string;
  projectName: string;
  sheetName: string;
  fileName: string;
  filePath: string;
  sheetUrl: string;
  totalIssues: number;
  pendingIssues: number;
  resolvedIssues: number;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  progress: number;
  lastUpdated: Date;
  createdAt: Date;
}

export interface Issue {
  _id: string;
  projectId: string;
  projectName: string;
  sheetName: string;
  fileId: string;
  issueId: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  systemStatus: 'open' | 'update' | 'progress' | 'completed';
  assignee: string;
  lineNumber: number | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  completedAt: Date | null;
}

export interface Note {
  _id: string;
  projectId?: string | null;
  date: string; // YYYY-MM-DD
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  _id: string;
  projectId?: string | null;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  isRead: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface Stats {
  overview: {
    totalProjects: number;
    totalFiles: number;
    totalIssues: number;
    openIssues: number;
    resolvedIssues: number;
    criticalIssues: number;
    resolutionRate: number;
  };
  issuesBySeverity: Record<string, number>;
  issuesByStatus: Record<string, number>;
  topFiles: Array<{
    fileName: string;
    issueCount: number;
  }>;
}

export interface ProjectStats {
  _id: string;
  name: string;
  googleSheetUrl: string;
  status: string;
  createdAt: Date;
  totalFiles: number;
  totalIssues: number;
  openIssues: number;
  resolvedIssues: number;
  criticalIssues: number;
  highIssues: number;
  resolutionRate: number;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

// ── Auth / User Types ─────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface TeamUser {
  _id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginResponse {
  token: string;
  user: Omit<TeamUser, 'password'>;
}

// ── Monitoring Types ──────────────────────────────────────────────────────────

export interface MonitorProject {
  _id: string;
  name: string;
  slug: string;
  description: string;
  telegramChatId: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonitorEnvironment {
  _id: string;
  projectId: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface MonitorEndpoint {
  _id: string;
  environmentId: string;
  projectId: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  expectedStatus: number;
  timeoutMs: number;
  intervalMinutes: number;
  enabled: boolean;
  lastStatus: 'up' | 'down' | 'degraded' | 'unknown';
  lastCheckedAt: Date | null;
  lastResponseTimeMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiskUsage {
  mount: string;
  usedPct: number;
  usedGb: number;
  totalGb: number;
}

export interface MonitorHost {
  _id: string;
  environmentId: string;
  projectId: string;
  name: string;
  mode: 'agent' | 'ssh';
  agentToken: string | null;
  enabled: boolean;
  lastSampledAt: Date | null;
  lastCpuPct: number | null;
  lastMemPct: number | null;
  lastDiskPct: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EndpointCheck {
  _id: string;
  endpointId: string;
  checkedAt: Date;
  status: 'up' | 'down' | 'degraded';
  httpStatus: number | null;
  responseTimeMs: number | null;
  error: string | null;
}

export interface HostMetric {
  _id: string;
  hostId: string;
  sampledAt: Date;
  cpuPct: number;
  memPct: number;
  memUsedMb: number;
  memTotalMb: number;
  disk: DiskUsage[];
  loadAvg: number[];
  uptimeSec: number;
  source: 'agent' | 'ssh';
}

export interface AlertRule {
  _id: string;
  targetType: 'endpoint' | 'host';
  targetId: string;
  projectId: string;
  name: string;
  condition: string;
  forMinutes: number;
  renotifyMinutes: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertEvent {
  _id: string;
  ruleId: string;
  targetType: 'endpoint' | 'host';
  targetId: string;
  projectId: string;
  firedAt: Date;
  recoveredAt: Date | null;
  state: 'firing' | 'recovered';
  lastNotifiedAt: Date | null;
  message: string;
}

export interface UptimeResult {
  uptimePct: number;
  totalChecks: number;
  downCount: number;
  avgResponseTimeMs: number;
  timeline: Array<{ date: string; uptimePct: number; totalChecks: number }>;
}

export interface MonitorOverviewEnv extends MonitorEnvironment {
  endpoints: { total: number; up: number; down: number; degraded: number; unknown: number };
  hosts: number;
  firingAlerts: number;
}

export interface MonitorOverviewProject extends MonitorProject {
  environments: MonitorOverviewEnv[];
}

// API Request types
export interface SyncGoogleSheetsRequest {
  projectName: string;
  googleSheetUrl: string;
  sheetName?: string;
}

export interface UpsertNoteRequest {
  date: string;
  content: string;
  projectId?: string;
}
