"use client"
import { useState } from "react"
import Header from "@/components/header"

export default function IssuesPage() {
  const [selectedItems, setSelectedItems] = useState<string[]>(['ERR-9082', 'ERR-9104'])

  const issues = [
    {
      id: 'ERR-9082',
      status: 'pending',
      description: 'Missing metadata headers in the transaction batch for 2023-10-12. Checksum validation failed.',
    },
    {
      id: 'ERR-9104',
      status: 'in-progress',
      description: 'Invalid date format in column \'created_at\'. Expected ISO-8601 but found unix timestamp.',
    },
    {
      id: 'ERR-8891',
      status: 'resolved',
      description: 'Duplicate primary key entries detected in rows 452 through 460.',
    },
    {
      id: 'ERR-9211',
      status: 'pending',
      description: 'Null values found in mandatory \'EmployeeID\' field across 15 records.',
    },
  ]

  return (
    <>
      <Header title="Issue Management" showImport={false} />
      <div className="p-8 space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Select Data Source</h2>
              <p className="text-sm text-slate-500">Choose a file to view and manage its associated issues.</p>
            </div>
            <div className="relative min-w-[340px]">
              <select className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:border-primary focus:ring-0 appearance-none cursor-pointer font-medium text-slate-700 dark:text-slate-200">
                <option value="file_1">Log_Analysis_Oct_2023.csv (42 issues)</option>
                <option value="file_2">User_Report_System_V2.xlsx (128 issues)</option>
                <option value="file_3">Backup_Validation_Result.json (3 issues)</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">expand_more</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
                <input
                  className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-1 focus:ring-primary w-full sm:w-80 text-slate-700 dark:text-slate-200"
                  placeholder="Filter issues by ID or content..."
                  type="text"
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300">
                <span className="material-symbols-outlined text-sm">filter_list</span>
                Filter
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-primary/5 dark:bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                <span className="text-xs font-semibold text-primary px-1">Selected: {selectedItems.length}</span>
                <div className="w-px h-4 bg-primary/30 mx-1"></div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors">
                  <span className="material-symbols-outlined text-sm">delete</span>
                  Remove
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-md shadow-sm hover:bg-primary/90 transition-colors">
                  <span className="material-symbols-outlined text-sm">done_all</span>
                  Processed
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-4 px-6 w-10">
                    <input
                      className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary dark:bg-slate-700 focus:ring-offset-0"
                      type="checkbox"
                    />
                  </th>
                  <th className="py-4 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">ID</th>
                  <th className="py-4 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-40">Status</th>
                  <th className="py-4 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Description</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {issues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6">
                      <input
                        checked={selectedItems.includes(issue.id)}
                        className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary dark:bg-slate-700 focus:ring-offset-0"
                        type="checkbox"
                        onChange={() => {}}
                      />
                    </td>
                    <td className="py-4 px-4 text-sm font-semibold font-mono text-slate-600 dark:text-slate-300">#{issue.id}</td>
                    <td className="py-4 px-4">
                      {issue.status === 'pending' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2"></span>
                          Pending
                        </span>
                      )}
                      {issue.status === 'in-progress' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mr-2"></span>
                          In Progress
                        </span>
                      )}
                      {issue.status === 'resolved' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span>
                          Resolved
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <p className={`text-sm ${issue.status === 'resolved' ? 'text-slate-500 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                        {issue.description}
                      </p>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" title="Remove Issue">
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Showing 1 to 4 of 42 entries</span>
            <div className="flex items-center gap-1">
              <button className="p-1.5 text-slate-400 hover:text-primary disabled:opacity-30" disabled>
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button className="w-8 h-8 flex items-center justify-center text-xs font-bold bg-primary text-white rounded-md shadow-sm">1</button>
              <button className="w-8 h-8 flex items-center justify-center text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">2</button>
              <button className="w-8 h-8 flex items-center justify-center text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">3</button>
              <span className="px-1 text-slate-400">...</span>
              <button className="p-1.5 text-slate-400 hover:text-primary">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined">pending</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pending</p>
              <p className="text-xl font-bold">18</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined">running_with_errors</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">In Progress</p>
              <p className="text-xl font-bold">12</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined">check_circle</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resolved</p>
              <p className="text-xl font-bold">34</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined">delete_sweep</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Removed</p>
              <p className="text-xl font-bold">5</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
