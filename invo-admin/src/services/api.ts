import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import type {
  Project,
  File,
  Issue,
  Note,
  Notification,
  Stats,
  ProjectStats,
  SyncGoogleSheetsRequest,
  UpsertNoteRequest,
  ApiResponse,
  MonitorProject,
  MonitorEnvironment,
  MonitorEndpoint,
  MonitorHost,
  EndpointCheck,
  HostMetric,
  AlertRule,
  AlertEvent,
  UptimeResult,
  MonitorOverviewProject
} from '@/types/api';

// Projects API
export const projectsApi = {
  getAll: () => apiGet<Project[]>('/projects'),
  getById: (id: string) => apiGet<Project>(`/projects/${id}`),
  create: (data: Partial<Project>) => apiPost<Project>('/projects', data),
  update: (id: string, data: Partial<Project>) => apiPut<Project>(`/projects/${id}`, data),
  delete: (id: string) => apiDelete<{ message: string; deletedProject: string; deletedFiles: number; deletedIssues: number }>(`/projects/${id}`),
};

// Files API
export const filesApi = {
  getAll: (projectId?: string) => {
    const query = projectId ? `?projectId=${projectId}` : '';
    return apiGet<File[]>(`/files${query}`);
  },
  getById: (id: string) => apiGet<File>(`/files/${id}`),
  update: (id: string, data: Partial<File>) => apiPut<File>(`/files/${id}`, data),
  delete: (id: string) => apiDelete<{ message: string; deletedFile: string; deletedIssues: number }>(`/files/${id}`),
};

// Issues API
export const issuesApi = {
  getAll: (filters?: {
    projectId?: string;
    fileId?: string;
    status?: string;
    severity?: string;
    assignee?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiGet<Issue[]>(`/issues${query}`);
  },
  getById: (id: string) => apiGet<Issue>(`/issues/${id}`),
  update: (id: string, data: Partial<Issue>) => apiPut<Issue>(`/issues/${id}`, data),
  complete: (id: string) => apiPut<Issue>(`/issues/${id}/complete`, {}),
  delete: (id: string) => apiDelete<{ message: string }>(`/issues/${id}`),
};

// Notes API
export const notesApi = {
  getMonthNotes: (year: number, month: number, projectId?: string) => {
    const params = new URLSearchParams({ year: year.toString(), month: month.toString() });
    if (projectId) params.append('projectId', projectId);
    return apiGet<Note[]>(`/notes/month?${params.toString()}`);
  },
  getByDate: (date: string, projectId?: string) => {
    const query = projectId ? `?projectId=${projectId}` : '';
    return apiGet<Note>(`/notes/${date}${query}`);
  },
  upsert: (data: UpsertNoteRequest) => apiPost<Note>('/notes', data),
  delete: (date: string, projectId?: string) => {
    const query = projectId ? `?projectId=${projectId}` : '';
    return apiDelete<{ message: string }>(`/notes/${date}${query}`);
  },
};

// Notifications API
export const notificationsApi = {
  getAll: (filters?: { projectId?: string; isRead?: boolean; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, value.toString());
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiGet<Notification[]>(`/notifications${query}`);
  },
  markAsRead: (id: string) => apiPut<Notification>(`/notifications/${id}/read`, {}),
  markAllAsRead: (projectId?: string) => {
    const query = projectId ? `?projectId=${projectId}` : '';
    return apiPut<{ message: string }>(`/notifications/read-all${query}`, {});
  },
  delete: (id: string) => apiDelete<{ message: string }>(`/notifications/${id}`),
};

// Sync API
export const syncApi = {
  syncGoogleSheets: (data: SyncGoogleSheetsRequest) => 
    apiPost<{
      project: { id: string; name: string };
      filesCount: number;
      issuesCount: number;
    }>('/sync/google-sheets', data),
};

// Stats API
export const statsApi = {
  getStats: (projectId?: string) => {
    const query = projectId ? `?projectId=${projectId}` : '';
    return apiGet<Stats>(`/stats${query}`);
  },
  getProjectStats: () => apiGet<ProjectStats[]>('/stats/projects'),
};

// Health check
export const healthApi = {
  check: () => apiGet<{ status: string; message: string }>('/health'),
};

// Monitoring API
export const monitoringApi = {
  // Overview
  getOverview: () => apiGet<MonitorOverviewProject[]>('/monitoring/overview'),

  // Projects
  listProjects: () => apiGet<MonitorProject[]>('/monitoring/projects'),
  getProject: (id: string) => apiGet<MonitorProject>(`/monitoring/projects/${id}`),
  createProject: (data: Partial<MonitorProject>) => apiPost<MonitorProject>('/monitoring/projects', data),
  updateProject: (id: string, data: Partial<MonitorProject>) => apiPut<MonitorProject>(`/monitoring/projects/${id}`, data),
  deleteProject: (id: string) => apiDelete<{ message: string }>(`/monitoring/projects/${id}`),

  // Environments
  listEnvironments: (projectId: string) => apiGet<MonitorEnvironment[]>(`/monitoring/projects/${projectId}/environments`),
  createEnvironment: (projectId: string, data: Partial<MonitorEnvironment>) =>
    apiPost<MonitorEnvironment>(`/monitoring/projects/${projectId}/environments`, data),
  updateEnvironment: (id: string, data: Partial<MonitorEnvironment>) => apiPut<MonitorEnvironment>(`/monitoring/environments/${id}`, data),
  deleteEnvironment: (id: string) => apiDelete<{ message: string }>(`/monitoring/environments/${id}`),

  // Endpoints
  listEndpoints: (environmentId: string) => apiGet<MonitorEndpoint[]>(`/monitoring/environments/${environmentId}/endpoints`),
  createEndpoint: (environmentId: string, data: Partial<MonitorEndpoint>) =>
    apiPost<MonitorEndpoint>(`/monitoring/environments/${environmentId}/endpoints`, data),
  updateEndpoint: (id: string, data: Partial<MonitorEndpoint>) => apiPut<MonitorEndpoint>(`/monitoring/endpoints/${id}`, data),
  deleteEndpoint: (id: string) => apiDelete<{ message: string }>(`/monitoring/endpoints/${id}`),
  checkNow: (id: string) => apiPost<{ status: string; httpStatus: number | null; responseTimeMs: number | null; error: string | null }>(`/monitoring/endpoints/${id}/check-now`),
  getEndpointHistory: (id: string, hours = 24) => apiGet<EndpointCheck[]>(`/monitoring/endpoints/${id}/history?hours=${hours}`),
  getEndpointUptime: (id: string, days = 7) => apiGet<UptimeResult>(`/monitoring/endpoints/${id}/uptime?days=${days}`),

  // Hosts
  listHosts: (environmentId: string) => apiGet<MonitorHost[]>(`/monitoring/environments/${environmentId}/hosts`),
  createHost: (environmentId: string, data: Partial<MonitorHost & { sshConfig?: object }>) =>
    apiPost<MonitorHost>(`/monitoring/environments/${environmentId}/hosts`, data),
  updateHost: (id: string, data: Partial<MonitorHost & { sshConfig?: object }>) => apiPut<MonitorHost>(`/monitoring/hosts/${id}`, data),
  deleteHost: (id: string) => apiDelete<{ message: string }>(`/monitoring/hosts/${id}`),
  rotateToken: (id: string) => apiPost<{ agentToken: string }>(`/monitoring/hosts/${id}/rotate-token`),
  getHostMetrics: (id: string, hours = 24) => apiGet<HostMetric[]>(`/monitoring/hosts/${id}/metrics?hours=${hours}`),

  // Alert Rules
  listAlertRules: (filters?: { targetId?: string; projectId?: string }) => {
    const params = filters ? new URLSearchParams(filters as any).toString() : '';
    return apiGet<AlertRule[]>(`/monitoring/alert-rules${params ? `?${params}` : ''}`);
  },
  createAlertRule: (data: Partial<AlertRule>) => apiPost<AlertRule>('/monitoring/alert-rules', data),
  updateAlertRule: (id: string, data: Partial<AlertRule>) => apiPut<AlertRule>(`/monitoring/alert-rules/${id}`, data),
  deleteAlertRule: (id: string) => apiDelete<{ message: string }>(`/monitoring/alert-rules/${id}`),

  // Alert Events
  listAlertEvents: (filters?: { state?: string; projectId?: string; limit?: number }) => {
    const params = filters ? new URLSearchParams(Object.entries(filters).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)]) as any).toString() : '';
    return apiGet<AlertEvent[]>(`/monitoring/alert-events${params ? `?${params}` : ''}`);
  },

  // Public status (no auth)
  getPublicStatus: (slug: string) => apiGet<any>(`/public/status/${slug}`),
};
