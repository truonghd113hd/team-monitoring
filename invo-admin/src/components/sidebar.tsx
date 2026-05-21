'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const ROLE_STYLE: Record<string, string> = {
  admin: 'bg-red-500/10 text-red-400 border-red-500/20',
  editor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  viewer: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();

  const navItem = (href: string, icon: string, label: string, badge?: React.ReactNode) => {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all ${
          active
            ? 'bg-primary text-white shadow-lg shadow-primary/20'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-primary dark:hover:text-white'
        }`}
      >
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
        <span className="flex-1">{label}</span>
        {badge}
      </Link>
    );
  };

  return (
    <aside className="w-64 bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 transition-colors duration-300">
      <div className="p-6">
        <div className="flex items-center gap-3 text-primary">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined font-bold">shield</span>
          </div>
          <span className="text-xl font-bold tracking-tight dark:text-white">AdminCore</span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 mt-2">
        {navItem('/', 'dashboard', 'Tổng quan')}
        {navItem('/issues', 'assignment_late', 'Quản lý Issue')}
        {navItem(
          '/notifications',
          'notifications',
          'Thông báo',
          <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm shadow-red-500/20">4</span>
        )}
        {navItem('/monitoring', 'monitor_heart', 'Monitoring')}
        {navItem('/tracker', 'task_alt', 'Tracker')}

        <div className="pt-6 pb-2 px-3 uppercase text-[10px] font-bold text-slate-400 tracking-widest">
          Cấu hình
        </div>

        {navItem('/settings', 'settings', 'Cài đặt hệ thống')}
        {isAdmin && navItem('/settings/users', 'manage_accounts', 'Quản lý người dùng')}
      </nav>

      {/* User card */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-transparent dark:border-slate-700/30">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {user?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate dark:text-white">{user?.name ?? '—'}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${ROLE_STYLE[user?.role ?? 'viewer']}`}>
                {user?.role ?? '—'}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="text-slate-400 hover:text-red-500 transition-colors p-1"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
