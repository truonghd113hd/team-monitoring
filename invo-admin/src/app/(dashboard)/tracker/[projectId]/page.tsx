'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/header';
import { trackerApi } from '@/services/api';
import { useSocket } from '@/contexts/SocketContext';
import IssueDetailModal from './IssueDetailModal';
import MarkdownEditor from '@/components/MarkdownEditor';
import type { TrackerProject, TrackerIssue, TrackerIssueStatus, TrackerIssuePriority, TrackerIssueType } from '@/types/api';

const ASSIGNEES = ['chounm28', 'khanh181296', 'thuhait03', 'truonghd113hd', 'VuDoiMu'];
const TC_RESULT_OPTIONS = ['Pass', 'Failed', 'N/A', 'Untested'];

function sheetTabUrl(project: TrackerProject | null | undefined, sheetName: string | null | undefined): string | null {
  if (!project?.googleSheetUrl || !sheetName) return null;
  const tab = project.googleSheetTabs?.find(t => t.name === sheetName);
  const base = project.googleSheetUrl.split('#')[0];
  return tab ? `${base}#gid=${tab.sheetId}` : base;
}

function tcResultBadge(v: string | null | undefined): string {
  if (v === 'Pass') return 'bg-green-500/10 text-green-600 border-green-500/20';
  if (v === 'Failed') return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (v === 'N/A') return 'bg-slate-100 dark:bg-slate-700 text-slate-500 border-slate-300';
  if (v === 'Untested') return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
  return 'bg-slate-100 dark:bg-slate-700 text-slate-400 border-slate-200';
}

function statusTestBadge(v: string | null | undefined): string {
  if (v === 'Passed') return 'bg-green-500/10 text-green-600 border-green-500/20';
  if (v === 'Wait') return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
  if (v === 'Reopen') return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (v === 'Close') return 'bg-slate-100 dark:bg-slate-700 text-slate-500 border-slate-300';
  return 'bg-slate-100 dark:bg-slate-700 text-slate-400 border-slate-200';
}

function statusDevBadge(v: string | null | undefined): string {
  if (v === 'Done') return 'bg-green-500/10 text-green-600 border-green-500/20';
  if (v === 'In progress') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  if (v === 'Reopen') return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (v === 'Close') return 'bg-slate-100 dark:bg-slate-700 text-slate-500 border-slate-300';
  return 'bg-slate-100 dark:bg-slate-700 text-slate-400 border-slate-200';
}

function deviceBadge(v: string | null | undefined): string {
  if (v === 'IOS') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  if (v === 'Android') return 'bg-green-500/10 text-green-600 border-green-500/20';
  if (v === 'All') return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
  return 'bg-slate-100 dark:bg-slate-700 text-slate-400 border-slate-200';
}

function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

type SelectOption = string | { value: string; label: string };

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
}) {
  const active = Boolean(value);
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`text-[11px] px-2 py-1 rounded-lg border focus:outline-none transition-colors cursor-pointer ${
        active
          ? 'border-primary text-primary bg-primary/5 dark:bg-primary/10 font-semibold'
          : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700'
      }`}
    >
      <option value="">{label}</option>
      {options.map(o => {
        const val = typeof o === 'string' ? o : o.value;
        const lbl = typeof o === 'string' ? o : o.label;
        return <option key={val} value={val}>{lbl}</option>;
      })}
    </select>
  );
}

const STATUS_TABS: Array<{ value: string; label: string; color: string }> = [
  { value: 'all', label: 'All', color: '' },
  { value: 'todo', label: 'Todo', color: 'text-slate-500' },
  { value: 'inprogress', label: 'In Progress', color: 'text-blue-500' },
  { value: 'review', label: 'Review', color: 'text-purple-500' },
  { value: 'done', label: 'Done', color: 'text-green-500' },
];

const PRIORITY_COLOR: Record<TrackerIssuePriority, string> = {
  critical: 'bg-red-500/10 text-red-500 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  low: 'bg-slate-500/10 text-slate-500 border-slate-300',
};

function priorityLabel(p: TrackerIssuePriority, type?: TrackerIssueType): string {
  if (p === 'critical') return type === 'testcase' ? 'Highest' : 'Urgent';
  if (p === 'high') return 'High';
  if (p === 'medium') return 'Medium';
  return 'Low';
}

const STATUS_BADGE: Record<TrackerIssueStatus, string> = {
  todo: 'bg-slate-100 dark:bg-slate-700 text-slate-500',
  inprogress: 'bg-blue-500/10 text-blue-500',
  review: 'bg-purple-500/10 text-purple-500',
  done: 'bg-green-500/10 text-green-500',
};

const STATUS_LABEL: Record<TrackerIssueStatus, string> = {
  todo: 'Todo',
  inprogress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

export default function TrackerProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { socket } = useSocket();

  const [project, setProject] = useState<TrackerProject | null>(null);
  const [issues, setIssues] = useState<TrackerIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'all');
  const [typeFilter, setTypeFilter] = useState<'all' | TrackerIssueType>('all');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const EMPTY_FORM = {
    title: '',
    description: '',
    status: 'todo' as TrackerIssueStatus,
    priority: 'medium' as TrackerIssuePriority,
    type: 'bug' as TrackerIssueType,
    assignees: [] as string[],
    syncGithub: false,
    milestoneNumber: null as number | null,
    milestoneTitle: '',
    // GS issue fields
    sheetName: '',
    module: '',
    initialCondition: '',
    testStep: '',
    expectedResult: '',
    actualResult: '',
    evidence: '',
    severity: '',
    device: '',
    note: '',
    issueDate: new Date().toISOString().slice(0, 10),
    // GS testcase fields
    tcName: '',
    iosStatus: '',
    androidStatus: '',
    version: '',
    testData: '',
  };
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [sheetTabs, setSheetTabs] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<{ number: number; title: string }[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef('');
  const [filters, setFilters] = useState({
    assignee: '', priority: '', sheetName: '',
    iosStatus: '', androidStatus: '',
    statusTest: '', statusDev: '', device: '',
  });
  const [filterOptions, setFilterOptions] = useState<{ assignees: string[]; sheetNames: string[] }>({ assignees: [], sheetNames: [] });
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Refs for stale-closure-free WS handlers
  const issuesRef = useRef<TrackerIssue[]>([]);
  const pageRef = useRef(0);
  const statusFilterRef = useRef(searchParams.get('status') ?? 'all');
  const totalRef = useRef(0);
  const filtersRef = useRef(filters);
  const sortByRef = useRef(sortBy);
  const sortDirRef = useRef(sortDir);

  const LIMIT = 20;

  const typeFilterRef = useRef<string>('all');

  const loadIssues = async (p: number, status: string, type?: string, activeFilters?: typeof filters) => {
    try {
      const f = activeFilters ?? filtersRef.current;
      const params: Parameters<typeof trackerApi.listIssues>[0] = {
        projectId, status, type: type ?? typeFilterRef.current, page: p,
        sortBy: sortByRef.current, sortDir: sortDirRef.current,
      };
      if (f.assignee) params.assignee = f.assignee;
      if (f.priority) params.priority = f.priority;
      if (f.sheetName) params.sheetName = f.sheetName;
      if (f.iosStatus) params.iosStatus = f.iosStatus;
      if (f.androidStatus) params.androidStatus = f.androidStatus;
      if (f.statusTest) params.statusTest = f.statusTest;
      if (f.statusDev) params.statusDev = f.statusDev;
      if (f.device) params.device = f.device;
      if (searchRef.current) params.search = searchRef.current;
      const res = await trackerApi.listIssues(params);
      const data = res.data as TrackerIssue[];
      setIssues(data);
      setTotal(res.total);
      issuesRef.current = data;
      totalRef.current = res.total;
    } catch (err) { console.error(err); }
  };

  // Keep refs in sync
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { statusFilterRef.current = statusFilter; }, [statusFilter]);
  useEffect(() => { typeFilterRef.current = typeFilter; }, [typeFilter]);
  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => { sortByRef.current = sortBy; sortDirRef.current = sortDir; }, [sortBy, sortDir]);

  // Debounced search
  useEffect(() => {
    searchRef.current = search;
    const t = setTimeout(() => { setPage(0); loadIssues(0, statusFilterRef.current, typeFilterRef.current); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    trackerApi.getProject(projectId).then(p => setProject(p as TrackerProject)).catch(console.error);
    trackerApi.getFilterOptions(projectId).then(opts => setFilterOptions(opts as { assignees: string[]; sheetNames: string[] })).catch(console.error);
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    loadIssues(page, statusFilter, typeFilter, filters).finally(() => setLoading(false));
  }, [projectId, page, statusFilter, typeFilter, filters, sortBy, sortDir]);

  // WS subscriptions
  useEffect(() => {
    if (!socket) return;

    const onIssueNew = (data: TrackerIssue) => {
      if (data.projectId !== projectId) return;
      // Only inject into list when on page 0 and filter matches
      const filterOk = statusFilterRef.current === 'all' || statusFilterRef.current === data.status;
      if (pageRef.current === 0 && filterOk) {
        const next = [data, ...issuesRef.current].slice(0, LIMIT);
        issuesRef.current = next;
        setIssues(next);
        setTotal(t => t + 1);
        totalRef.current = totalRef.current + 1;
      }
    };

    const onIssueUpdated = (data: Partial<TrackerIssue> & { _id: string; projectId: string }) => {
      if (data.projectId !== projectId) return;
      const next = issuesRef.current.map(i =>
        i._id === data._id ? { ...i, ...data } : i
      );
      issuesRef.current = next;
      setIssues(next);
    };

    const onProjectSynced = (data: { projectId: string; lastSync?: string }) => {
      if (data.projectId !== projectId) return;
      // Refresh issues + filter options after any sync completes
      loadIssues(0, statusFilterRef.current, typeFilterRef.current, filtersRef.current);
      setPage(0);
      trackerApi.getFilterOptions(projectId).then(opts => setFilterOptions(opts as { assignees: string[]; sheetNames: string[] })).catch(console.error);
      if (data.lastSync) {
        setProject(p => p ? { ...p, googleSheetLastSync: new Date(data.lastSync!) } : p);
      }
    };

    socket.on('tracker:issue:new', onIssueNew);
    socket.on('tracker:issue:updated', onIssueUpdated);
    socket.on('tracker:project:synced', onProjectSynced);

    return () => {
      socket.off('tracker:issue:new', onIssueNew);
      socket.off('tracker:issue:updated', onIssueUpdated);
      socket.off('tracker:project:synced', onProjectSynced);
    };
  }, [socket, projectId]);

  const handleTabChange = (s: string) => {
    setStatusFilter(s);
    setPage(0);
  };

  const handleTypeChange = (t: 'all' | TrackerIssueType) => {
    setTypeFilter(t);
    setPage(0);
  };

  const EMPTY_FILTERS = { assignee: '', priority: '', sheetName: '', iosStatus: '', androidStatus: '', statusTest: '', statusDev: '', device: '' };

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    const next = { ...filtersRef.current, [key]: value };
    filtersRef.current = next;
    setFilters(next);
    setPage(0);
  };

  const hasActiveFilters = Object.values(filters).some(Boolean) || Boolean(search);

  const clearFilters = () => {
    filtersRef.current = EMPTY_FILTERS;
    setFilters(EMPTY_FILTERS);
    searchRef.current = '';
    setSearch('');
    setPage(0);
  };

  const handleSort = (col: string) => {
    const next = col === sortBy ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    sortByRef.current = col;
    sortDirRef.current = next as 'asc' | 'desc';
    setSortBy(col);
    setSortDir(next as 'asc' | 'desc');
    setPage(0);
  };

  const SortBtn = ({ col, label }: { col: string; label: string }) => (
    <button onClick={() => handleSort(col)}
      className="flex items-center gap-0.5 hover:text-primary transition-colors group">
      {label}
      <span className={`material-symbols-outlined text-[11px] transition-opacity ${sortBy === col ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-50'}`}>
        {sortBy === col && sortDir === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
      </span>
    </button>
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await trackerApi.createIssue({
        projectId,
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        type: form.type,
        assignees: form.assignees,
        syncGithub: form.syncGithub,
        milestoneNumber: form.milestoneNumber,
        milestoneTitle: milestones.find(m => m.number === form.milestoneNumber)?.title ?? form.milestoneTitle,
        ...(form.type === 'issue' ? {
          sheetName: form.sheetName || undefined,
          module: form.module,
          initialCondition: form.initialCondition,
          testStep: form.testStep,
          expectedResult: form.expectedResult,
          actualResult: form.actualResult,
          evidence: form.evidence,
          severity: form.severity,
          device: form.device,
          note: form.note,
          issueDate: form.issueDate,
        } : form.type === 'testcase' ? {
          sheetName: form.sheetName || undefined,
          tcName: form.tcName || undefined,
          iosStatus: form.iosStatus || undefined,
          androidStatus: form.androidStatus || undefined,
          version: form.version || undefined,
          testData: form.testData || undefined,
          initialCondition: form.initialCondition || undefined,
          testStep: form.testStep || undefined,
          expectedResult: form.expectedResult || undefined,
          actualResult: form.actualResult || undefined,
        } : {}),
      } as any);
      setShowNew(false);
      setForm(EMPTY_FORM);
      setPage(0);
      await loadIssues(0, statusFilter);
    } catch (err) { alert((err as Error).message); }
    finally { setSaving(false); }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="flex flex-col h-full">
      <Header title={project?.name ?? 'Project'} />
      <main className="flex-1 p-8 overflow-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
          <Link href="/tracker" className="hover:text-primary">Tracker</Link>
          <span>/</span>
          <span className="dark:text-white font-medium flex items-center gap-2">
            {project && <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: project.color }} />}
            {project?.name ?? '…'}
            {project?.googleSheetLastSync && (
              <span className="text-[10px] text-slate-400 font-normal flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[11px]">schedule</span>
                {relativeTime(project.googleSheetLastSync)}
              </span>
            )}
          </span>
        </div>

        {/* Type tabs */}
        <div className="flex items-center gap-1 mb-3">
          {([
            { value: 'all', label: 'All', icon: 'list' },
            { value: 'bug', label: 'Bugs', icon: 'bug_report' },
            { value: 'testcase', label: 'Test Cases', icon: 'labs' },
            { value: 'issue', label: 'Issues', icon: 'assignment_late' },
          ] as const).map(t => (
            <button
              key={t.value}
              onClick={() => handleTypeChange(t.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                typeFilter === t.value
                  ? t.value === 'bug'
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : t.value === 'testcase'
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : t.value === 'issue'
                        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-sm">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap mb-4 py-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide shrink-0">Filter</span>
          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">search</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search issues…"
              className="pl-7 pr-3 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/50 w-44"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
          {/* Assignee */}
          {filterOptions.assignees.length > 0 && (
            <FilterSelect
              label="Assignee" value={filters.assignee}
              onChange={v => handleFilterChange('assignee', v)}
              options={filterOptions.assignees}
            />
          )}
          {/* Priority */}
          <FilterSelect
            label="Priority" value={filters.priority}
            onChange={v => handleFilterChange('priority', v)}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'critical', label: 'Urgent / Highest' },
            ]}
          />
          {/* Sheet name */}
          {project?.googleSheetId && filterOptions.sheetNames.length > 0 && (
            <FilterSelect
              label="Sheet" value={filters.sheetName}
              onChange={v => handleFilterChange('sheetName', v)}
              options={filterOptions.sheetNames}
            />
          )}
          {/* Testcase-specific */}
          {typeFilter === 'testcase' && (<>
            <FilterSelect
              label="iOS" value={filters.iosStatus}
              onChange={v => handleFilterChange('iosStatus', v)}
              options={['Pass', 'Failed', 'N/A', 'Untested']}
            />
            <FilterSelect
              label="Android" value={filters.androidStatus}
              onChange={v => handleFilterChange('androidStatus', v)}
              options={['Pass', 'Failed', 'N/A', 'Untested']}
            />
          </>)}
          {/* Issue-specific */}
          {typeFilter === 'issue' && (<>
            <FilterSelect
              label="Test Status" value={filters.statusTest}
              onChange={v => handleFilterChange('statusTest', v)}
              options={['Passed', 'Wait', 'Close', 'Reopen']}
            />
            <FilterSelect
              label="Dev Status" value={filters.statusDev}
              onChange={v => handleFilterChange('statusDev', v)}
              options={['Done', 'In progress', 'Reopen', 'Close']}
            />
            <FilterSelect
              label="Device" value={filters.device}
              onChange={v => handleFilterChange('device', v)}
              options={['IOS', 'Android', 'All']}
            />
          </>)}
          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-0.5 text-[11px] text-red-500 hover:text-red-700 ml-1 transition-colors">
              <span className="material-symbols-outlined text-sm">close</span>
              Clear
            </button>
          )}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {STATUS_TABS.map(t => (
              <button
                key={t.value}
                onClick={() => handleTabChange(t.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === t.value
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {/* External links: GitHub project + Google Sheet */}
            {project?.githubProjectUrl && (
              <a
                href={project.githubProjectUrl}
                target="_blank" rel="noopener noreferrer"
                title="Open GitHub Project"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium transition-colors"
              >
                <span className="material-symbols-outlined text-sm">code</span>GitHub
              </a>
            )}
            {project?.googleSheetUrl && (
              <a
                href={project.googleSheetUrl}
                target="_blank" rel="noopener noreferrer"
                title="Open Google Sheet"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-green-600 hover:border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 text-xs font-medium transition-colors"
              >
                <span className="material-symbols-outlined text-sm">table_chart</span>Sheet
              </a>
            )}
            {(project?.githubProjectId || project?.googleSheetId) && (
              <button
                onClick={async () => {
                  setSyncing(true);
                  try { await trackerApi.syncNow(projectId); }
                  catch (err) { alert((err as Error).message); }
                  finally { setSyncing(false); }
                }}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-green-300 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50 transition-colors"
              >
                <span className={`material-symbols-outlined text-sm ${syncing ? 'animate-spin' : ''}`}>sync</span>
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
            )}
            <button
              onClick={async () => {
                // Derive default type: explicit tab wins; fall back to project's primary content type
                const isGhProject = !!project?.githubProjectId;
                const hasTc = !!project?.stats?.hasTestcase;
                const hasIs = !!project?.stats?.hasIssue;
                const hasBg = !!project?.stats?.hasBug;
                const defaultType: TrackerIssueType =
                  isGhProject && typeFilter !== 'testcase' && typeFilter !== 'issue' ? 'bug'
                  : typeFilter === 'testcase' ? 'testcase'
                  : typeFilter === 'issue' ? 'issue'
                  : typeFilter === 'bug' ? 'bug'
                  // 'all' tab — use project's primary type
                  : hasTc && !hasIs && !hasBg ? 'testcase'
                  : hasIs && !hasTc && !hasBg ? 'issue'
                  : isGhProject ? 'bug'
                  : 'bug';
                setForm({ ...EMPTY_FORM, type: defaultType as TrackerIssueType });
                setShowNew(true);
                // Load sheet tabs
                const cached = filterOptions.sheetNames;
                if (cached.length > 0) {
                  setSheetTabs(cached);
                } else if (project?.googleSheetUrl) {
                  try {
                    const res = await trackerApi.getSheetTabs(project.googleSheetUrl);
                    setSheetTabs((res as any).tabs ?? []);
                  } catch { /* no sheet configured */ }
                }
                // Load milestones if repo linked
                if (project?.githubRepo && milestones.length === 0) {
                  try {
                    const ms = await trackerApi.getMilestones(projectId);
                    setMilestones((ms as any) ?? []);
                  } catch { /* no milestones */ }
                }
              }}
              className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Issue
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
          {/* Column headers */}
          {typeFilter === 'testcase' ? (
            <div className="grid grid-cols-[3rem_1.5rem_6rem_1fr_6rem_6rem_6rem_5rem] gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              <SortBtn col="id" label="#" /><span></span><span>ID</span><span>Description</span>
              <SortBtn col="priority" label="Priority" /><span>iOS</span><span>Android</span><span className="text-right">Version</span>
            </div>
          ) : typeFilter === 'issue' ? (
            <div className="grid grid-cols-[3rem_1.5rem_6rem_1fr_6rem_7rem_7rem_6rem] gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              <SortBtn col="id" label="#" /><span></span><span>Bug ID</span><span>Title</span>
              <SortBtn col="priority" label="Priority" /><SortBtn col="status" label="Test Status" /><span>Dev Status</span><span className="text-right">Device</span>
            </div>
          ) : (
            <div className="grid grid-cols-[3rem_1.5rem_1fr_7rem_8rem_7rem_6rem] gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              <SortBtn col="id" label="#" /><span></span><span>Title</span>
              <SortBtn col="priority" label="Priority" />
              <span>Assignees</span><SortBtn col="status" label="Status" /><span className="text-right">Created</span>
            </div>
          )}

          {loading ? (
            <div className="py-10 text-center text-slate-400">Loading…</div>
          ) : issues.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <span className="material-symbols-outlined text-3xl block mb-2">inbox</span>
              No issues{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-700/40">
              {issues.map(issue => {
                // GitHub items always use the unified GitHub row regardless of stored type
                const isGh = !!issue.githubIssueUrl;
                if (!isGh && issue.type === 'issue' && typeFilter === 'issue') return (
                <div
                  key={issue._id}
                  onClick={() => setSelectedIssueId(issue._id)}
                  className="grid grid-cols-[3rem_1.5rem_6rem_1fr_6rem_7rem_7rem_6rem] gap-3 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group cursor-pointer"
                >
                  <span className="text-xs text-slate-400 font-mono">#{issue.number}</span>
                  <span title="Issue"><span className="material-symbols-outlined text-sm text-orange-400">assignment_late</span></span>
                  <span className="text-xs text-slate-500 font-mono truncate">{issue.sheetIssueId ?? `#${issue.number}`}</span>
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-medium dark:text-white group-hover:text-primary truncate">{issue.title}</span>
                    <span className="flex items-center gap-1.5 mt-0.5">
                      {issue.sheetName && <span className="text-[9px] text-slate-400 truncate">{issue.sheetName}</span>}
                      {issue.milestoneTitle && <span className="text-[9px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-1.5 rounded-full shrink-0">🏁 {issue.milestoneTitle}</span>}
                    </span>
                  </span>
                  <span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${PRIORITY_COLOR[issue.priority]}`}>
                      {priorityLabel(issue.priority, issue.type)}
                    </span>
                  </span>
                  <span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${statusTestBadge(issue.statusTest)}`}>
                      {issue.statusTest ?? '—'}
                    </span>
                  </span>
                  <span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${statusDevBadge(issue.statusDev)}`}>
                      {issue.statusDev ?? '—'}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${deviceBadge(issue.device)}`}>
                      {issue.device ?? '—'}
                    </span>
                  </span>
                </div>
                );
                if (!isGh && issue.type === 'testcase' && typeFilter === 'testcase') return (
                <div
                  key={issue._id}
                  onClick={() => setSelectedIssueId(issue._id)}
                  className="grid grid-cols-[3rem_1.5rem_6rem_1fr_6rem_6rem_6rem_5rem] gap-3 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group cursor-pointer"
                >
                  <span className="text-xs text-slate-400 font-mono">#{issue.number}</span>
                  <span title="Test Case">
                    <span className="material-symbols-outlined text-sm text-blue-400">labs</span>
                  </span>
                  <span className="text-xs text-slate-500 font-mono truncate">{issue.sheetIssueId ?? `#${issue.number}`}</span>
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-medium dark:text-white group-hover:text-primary truncate">{issue.title}</span>
                    <span className="flex items-center gap-1.5 mt-0.5">
                      {issue.sheetName && <span className="text-[9px] text-slate-400 truncate">{issue.sheetName}</span>}
                      {issue.milestoneTitle && <span className="text-[9px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-1.5 rounded-full shrink-0">🏁 {issue.milestoneTitle}</span>}
                    </span>
                  </span>
                  <span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${PRIORITY_COLOR[issue.priority]}`}>
                      {priorityLabel(issue.priority, issue.type)}
                    </span>
                  </span>
                  <span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tcResultBadge(issue.iosStatus)}`}>
                      {issue.iosStatus ?? '—'}
                    </span>
                  </span>
                  <span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tcResultBadge(issue.androidStatus)}`}>
                      {issue.androidStatus ?? '—'}
                    </span>
                  </span>
                  <span className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 truncate">{issue.version ?? '—'}</span>
                    {issue.sheetName && sheetTabUrl(project, issue.sheetName) && (
                      <span onClick={e => e.stopPropagation()}>
                        <a href={sheetTabUrl(project, issue.sheetName)!} target="_blank" rel="noopener noreferrer"
                          title={`Open sheet: ${issue.sheetName}`} className="text-slate-400 hover:text-green-600 transition-colors">
                          <span className="material-symbols-outlined text-sm">table_chart</span>
                        </a>
                      </span>
                    )}
                  </span>
                </div>
                );
                return (
                <div
                  key={issue._id}
                  onClick={() => setSelectedIssueId(issue._id)}
                  className="grid grid-cols-[3rem_1.5rem_1fr_7rem_8rem_7rem_5.5rem_1.5rem] gap-3 px-4 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group cursor-pointer"
                >
                  <span className="text-xs text-slate-400 font-mono">#{issue.number}</span>
                  <span title={issue.type === 'bug' ? 'Bug' : 'GS Issue'}>
                    <span className={`material-symbols-outlined text-sm ${issue.type === 'bug' ? 'text-red-400' : 'text-orange-400'}`}>
                      {issue.type === 'bug' ? 'bug_report' : 'assignment_late'}
                    </span>
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-medium dark:text-white group-hover:text-primary truncate">{issue.title}</span>
                    <span className="flex items-center gap-1.5 mt-0.5">
                      {issue.sheetName && <span className="text-[9px] text-slate-400 truncate">{issue.sheetName}</span>}
                      {issue.milestoneTitle && <span className="text-[9px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-1.5 rounded-full shrink-0">🏁 {issue.milestoneTitle}</span>}
                    </span>
                  </span>
                  <span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${PRIORITY_COLOR[issue.priority]}`}>
                      {priorityLabel(issue.priority, issue.type)}
                    </span>
                  </span>
                  <span className="text-xs text-slate-400 truncate">
                    {issue.assignees.length > 0 ? issue.assignees.join(', ') : '—'}
                  </span>
                  <span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[issue.status]}`}>
                      {STATUS_LABEL[issue.status]}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400 text-right whitespace-nowrap">
                    {new Date(issue.createdAt).toLocaleDateString()}
                  </span>
                  {/* External link: GitHub issue or Google Sheet tab */}
                  <span onClick={e => e.stopPropagation()} className="flex justify-center">
                    {issue.githubIssueUrl ? (
                      <a href={issue.githubIssueUrl} target="_blank" rel="noopener noreferrer"
                        title="View on GitHub" className="text-slate-400 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                      </a>
                    ) : sheetTabUrl(project, issue.sheetName) ? (
                      <a href={sheetTabUrl(project, issue.sheetName)!} target="_blank" rel="noopener noreferrer"
                        title={`Open sheet: ${issue.sheetName}`} className="text-slate-400 hover:text-green-600 transition-colors">
                        <span className="material-symbols-outlined text-sm">table_chart</span>
                      </a>
                    ) : null}
                  </span>
                </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400">
            <span>{total} issue{total !== 1 ? 's' : ''} · Page {page + 1} / {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
                className="px-2 py-1 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">‹</button>
              <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * LIMIT >= total}
                className="px-2 py-1 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">›</button>
            </div>
          </div>
        </div>
      </main>

      {/* Issue detail modal */}
      {selectedIssueId && (
        <IssueDetailModal
          issueId={selectedIssueId}
          onClose={() => setSelectedIssueId(null)}
          onIssueUpdated={(id, patch) => {
            const next = issuesRef.current.map(i => i._id === id ? { ...i, ...patch } : i);
            issuesRef.current = next;
            setIssues(next);
          }}
        />
      )}

      {/* New Issue modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setShowNew(false); setForm(EMPTY_FORM); }}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold dark:text-white mb-4">
              {form.type === 'testcase' ? '🧪 New Test Case' : form.type === 'issue' ? '📋 New GS Issue' : '🐛 New Issue'}
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Priority + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TrackerIssuePriority }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">{form.type === 'testcase' ? 'Highest' : 'Urgent'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TrackerIssueStatus }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                    <option value="todo">Todo</option>
                    <option value="inprogress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>

              {/* Sheet name (GS testcase) */}
              {form.type === 'testcase' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Sheet Name {sheetTabs.length === 0 && project?.googleSheetUrl ? <span className="text-slate-300">(loading…)</span> : ''}
                  </label>
                  {sheetTabs.length > 0 ? (
                    <select value={form.sheetName} onChange={e => setForm(f => ({ ...f, sheetName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                      <option value="">Select sheet tab…</option>
                      {sheetTabs.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    <input value={form.sheetName} onChange={e => setForm(f => ({ ...f, sheetName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none"
                      placeholder="Sheet tab name" />
                  )}
                </div>
              )}

              {/* Sheet name + Module (GS issue) */}
              {form.type === 'issue' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Sheet Name {sheetTabs.length === 0 && project?.googleSheetUrl ? <span className="text-slate-300">(loading…)</span> : ''}
                      {!project?.googleSheetUrl && <span className="text-slate-300">(no sheet linked)</span>}
                    </label>
                    {sheetTabs.length > 0 ? (
                      <select
                        required={form.type === 'issue'}
                        value={form.sheetName}
                        onChange={e => setForm(f => ({ ...f, sheetName: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none"
                      >
                        <option value="">Select sheet tab…</option>
                        {sheetTabs.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (
                      <input
                        value={form.sheetName}
                        onChange={e => setForm(f => ({ ...f, sheetName: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none"
                        placeholder="Sheet tab name"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Module</label>
                    <input value={form.module} onChange={e => setForm(f => ({ ...f, module: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none"
                      placeholder="e.g. Auth / Payment" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {form.type === 'testcase' ? 'Description *' : 'Title *'}
                </label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder={form.type === 'issue' ? 'Issue title (GitHub: Module | Title)' : form.type === 'testcase' ? 'Test case description…' : 'Issue title'} />
              </div>

              {form.type !== 'testcase' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                  <MarkdownEditor
                    value={form.description}
                    onChange={v => setForm(f => ({ ...f, description: v }))}
                    placeholder="Describe the issue… (supports Markdown)"
                    rows={4}
                  />
                </div>
              )}

              {/* GS Testcase extra fields */}
              {form.type === 'testcase' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Name</label>
                      <input
                        value={form.tcName}
                        onChange={e => setForm(f => ({ ...f, tcName: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none"
                        placeholder="e.g. TC-001 (auto if empty)" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Version</label>
                      <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none"
                        placeholder="e.g. 1.2.3" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">phone_iphone</span>iOS Result
                      </label>
                      <select value={form.iosStatus} onChange={e => setForm(f => ({ ...f, iosStatus: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                        <option value="">— Not set —</option>
                        {TC_RESULT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">android</span>Android Result
                      </label>
                      <select value={form.androidStatus} onChange={e => setForm(f => ({ ...f, androidStatus: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                        <option value="">— Not set —</option>
                        {TC_RESULT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Actual Result</label>
                    <textarea rows={2} value={form.actualResult} onChange={e => setForm(f => ({ ...f, actualResult: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Initial Condition</label>
                    <textarea rows={2} value={form.initialCondition} onChange={e => setForm(f => ({ ...f, initialCondition: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Test Data</label>
                    <textarea rows={2} value={form.testData} onChange={e => setForm(f => ({ ...f, testData: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none resize-none"
                      placeholder="Input data used for this test case…" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Steps</label>
                    <textarea rows={3} value={form.testStep} onChange={e => setForm(f => ({ ...f, testStep: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Expected Result</label>
                    <textarea rows={2} value={form.expectedResult} onChange={e => setForm(f => ({ ...f, expectedResult: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none resize-none" />
                  </div>
                </>
              )}

              {/* GS Issue extra fields */}
              {form.type === 'issue' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Precondition</label>
                    <textarea rows={2} value={form.initialCondition} onChange={e => setForm(f => ({ ...f, initialCondition: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none resize-none"
                      placeholder="Preconditions before reproducing…" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Steps to Reproduce</label>
                    <textarea rows={3} value={form.testStep} onChange={e => setForm(f => ({ ...f, testStep: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none resize-none"
                      placeholder="1. Go to…&#10;2. Click…&#10;3. See error" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Expected Result</label>
                      <textarea rows={2} value={form.expectedResult} onChange={e => setForm(f => ({ ...f, expectedResult: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none resize-none"
                        placeholder="Expected behaviour…" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Actual Result</label>
                      <textarea rows={2} value={form.actualResult} onChange={e => setForm(f => ({ ...f, actualResult: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none resize-none"
                        placeholder="What actually happened…" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Evidence (URL or description)</label>
                    <input value={form.evidence} onChange={e => setForm(f => ({ ...f, evidence: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none"
                      placeholder="https://…" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Severity</label>
                      <input value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none"
                        placeholder="Critical / Major…" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Device</label>
                      <select value={form.device} onChange={e => setForm(f => ({ ...f, device: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none">
                        <option value="">—</option>
                        <option value="IOS">IOS</option>
                        <option value="Android">Android</option>
                        <option value="All">All</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
                      <input type="date" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Note</label>
                    <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none"
                      placeholder="Additional notes…" />
                  </div>
                </>
              )}

              {/* Assignees */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Assignees</label>
                <div className="flex flex-wrap gap-2">
                  {ASSIGNEES.map(a => {
                    const selected = form.assignees.includes(a);
                    return (
                      <button key={a} type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          assignees: selected ? f.assignees.filter(x => x !== a) : [...f.assignees, a]
                        }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          selected
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 hover:border-primary/50'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {a[0].toUpperCase()}
                        </span>
                        {a}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bug/GitHub section: Milestone (any project with a linked repo) + sync checkbox (GS-only) */}
              {form.type === 'bug' && project?.githubRepo && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 bg-slate-50 dark:bg-slate-700/30 space-y-3">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">code</span>GitHub
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Milestone</label>
                    <select
                      value={form.milestoneNumber ?? ''}
                      onChange={e => setForm(f => ({ ...f, milestoneNumber: e.target.value ? Number(e.target.value) : null }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white text-sm focus:outline-none"
                    >
                      <option value="">No milestone</option>
                      {milestones.map(m => (
                        <option key={m.number} value={m.number}>{m.title}</option>
                      ))}
                    </select>
                  </div>
                  {/* Sync checkbox only for GS projects — GitHub projects auto-sync */}
                  {!project?.githubProjectId && (
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={form.syncGithub}
                          onChange={e => setForm(f => ({ ...f, syncGithub: e.target.checked }))}
                          className="w-4 h-4 rounded border-slate-300 text-primary accent-primary"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-300">Sync to GitHub</span>
                      </label>
                      {form.syncGithub && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${PRIORITY_COLOR[form.priority]}`}>
                          Label: {priorityLabel(form.priority, 'bug')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* GS testcase / issue sync checkbox — show whenever there's a GitHub repo to push to */}
              {form.type !== 'bug' && project?.githubRepo && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.syncGithub}
                    onChange={e => setForm(f => ({ ...f, syncGithub: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-primary accent-primary"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Sync with GitHub
                    {form.type === 'issue' && form.module && form.title && (
                      <span className="ml-1.5 text-[11px] text-slate-400 font-mono">
                        "{form.module} | {form.title}"
                      </span>
                    )}
                  </span>
                </label>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => { setShowNew(false); setForm(EMPTY_FORM); }}
                  className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-blue-600 disabled:opacity-50">
                  {saving ? 'Creating…' : form.syncGithub && form.type === 'bug' ? 'Create & Sync to GitHub' : form.type === 'testcase' ? 'Create Test Case' : form.type === 'issue' ? 'Create GS Issue' : 'Create Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
