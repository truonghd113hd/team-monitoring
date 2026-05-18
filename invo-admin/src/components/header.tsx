"use client"
import { ModeToggle } from "./mode-toggle"

interface HeaderProps {
  title: string
  showImport?: boolean
}

export default function Header({ title, showImport = false }: HeaderProps) {
  return (
    <header className="h-16 flex items-center justify-between px-8 bg-white/80 dark:bg-[#0f172a]/95 backdrop-blur-md sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold dark:text-white">{title}</h1>
        <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] font-bold rounded uppercase tracking-wider border border-green-500/20">
          Live
        </span>
      </div>

      <div className="flex items-center gap-4">
        <ModeToggle />
        
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
        
        <div className="relative hidden md:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            search
          </span>
          <input
            className="bg-slate-100 dark:bg-slate-800/50 border border-transparent dark:border-slate-700 rounded-lg text-sm pl-9 pr-4 py-2 w-64 focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-slate-400 dark:text-white"
            placeholder="Tìm kiếm tài liệu..."
            type="text"
          />
        </div>

        {showImport && (
          <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-all shadow-md shadow-primary/20">
            <span className="material-symbols-outlined text-sm">upload_file</span>
            Import File
          </button>
        )}
      </div>
    </header>
  )
}