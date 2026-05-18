"use client"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-20 h-9" />

  return (
    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-1 border border-slate-200 dark:border-slate-700">
      <button
        onClick={() => setTheme('light')}
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
          theme === 'light' 
            ? 'bg-white shadow-sm text-amber-500' 
            : 'text-slate-400 hover:text-amber-500'
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">light_mode</span>
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
          theme === 'dark' 
            ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-500 dark:text-indigo-300' 
            : 'text-slate-400 hover:text-indigo-500'
        }`}
      >
        <span className={`material-symbols-outlined text-[18px] ${theme === 'dark' ? 'fill-current' : ''}`}>
          dark_mode
        </span>
      </button>
    </div>
  )
}