"use client"
import { useEffect, useState } from "react"
import Header from "@/components/header"
import Calendar from "@/components/calendar"
import { filesApi, notificationsApi, statsApi, syncApi, projectsApi } from "@/services/api"
import type { File, Notification, ProjectStats } from "@/types/api"

export default function HomePage() {
  const [files, setFiles] = useState<File[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    projectId: string | null;
    projectName: string | null;
    fileCount: number;
    issueCount: number;
  }>({
    isOpen: false,
    projectId: null,
    projectName: null,
    fileCount: 0,
    issueCount: 0
  })
  
  // Import form state
  const [projectName, setProjectName] = useState('')
  const [googleSheetUrl, setGoogleSheetUrl] = useState('')
  const [sheetName, setSheetName] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [filesData, notificationsData, projectStatsData] = await Promise.all([
        filesApi.getAll(),
        notificationsApi.getAll({ limit: 5 }),
        statsApi.getProjectStats()
      ])
      setFiles(filesData.slice(0, 4)) // Top 4 files
      setNotifications(notificationsData)
      setProjectStats(projectStatsData)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!projectName.trim() || !googleSheetUrl.trim()) {
      alert('Vui lòng nhập tên project và đường dẫn Google Sheets')
      return
    }

    try {
      setImporting(true)
      await syncApi.syncGoogleSheets({
        projectName: projectName.trim(),
        googleSheetUrl: googleSheetUrl.trim(),
        sheetName: sheetName.trim() || undefined
      })
      
      // Clear form and refresh data
      setProjectName('')
      setGoogleSheetUrl('')
      setSheetName('')
      await fetchData()
      
      alert('Import thành công!')
    } catch (error: any) {
      console.error('Import failed:', error)
      alert(`Import thất bại: ${error.message || 'Unknown error'}`)
    } finally {
      setImporting(false)
    }
  }

  const openDeleteConfirmation = (project: ProjectStats) => {
    setDeleteConfirmation({
      isOpen: true,
      projectId: project._id,
      projectName: project.name,
      fileCount: project.totalFiles,
      issueCount: project.totalIssues
    })
  }

  const closeDeleteConfirmation = () => {
    setDeleteConfirmation({
      isOpen: false,
      projectId: null,
      projectName: null,
      fileCount: 0,
      issueCount: 0
    })
  }

  const handleDeleteProject = async () => {
    if (!deleteConfirmation.projectId) return

    try {
      const result = await projectsApi.delete(deleteConfirmation.projectId)
      
      closeDeleteConfirmation()
      await fetchData() // Refresh data
      
      alert(`Đã xóa project "${deleteConfirmation.projectName}" (${result.deletedFiles} files, ${result.deletedIssues} issues)`)
    } catch (error: any) {
      console.error('Delete failed:', error)
      alert(`Xóa thất bại: ${error.message || 'Unknown error'}`)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'error': return 'red';
      case 'in-progress': return 'yellow';
      case 'completed': return 'green';
      default: return 'blue';
    }
  }

  const getSeverityColor = (progress: number) => {
    if (progress >= 80) return 'green';
    if (progress >= 50) return 'yellow';
    if (progress >= 25) return 'orange';
    return 'red';
  }

  return (
    <>
      <Header title="Tổng quan hệ thống" showImport={true} />
      
      <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
        {/* Project Statistics Section */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1 h-3 bg-primary rounded-full"></span>
              Thống kê theo Project
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse">
                  <div className="h-32"></div>
                </div>
              ))}
            </div>
          ) : projectStats.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              Chưa có project nào. Hãy import dữ liệu để bắt đầu.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projectStats.map((project) => {
                const criticalColor = project.criticalIssues > 0 ? 'red' : 
                                     project.highIssues > 0 ? 'orange' : 
                                     project.openIssues > 0 ? 'yellow' : 'green';
                
                return (
                  <div key={project._id} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-primary/40 dark:hover:border-primary/40 hover:shadow-md transition-all group dark:shadow-slate-900/50">
                    {/* Project Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold dark:text-white truncate mb-1">
                          {project.name}
                        </h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {project.totalFiles} files
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`p-2 bg-${criticalColor}-500/10 text-${criticalColor}-500 rounded-lg group-hover:scale-110 transition-transform`}>
                          <span className="material-symbols-outlined">folder</span>
                        </div>
                        <button
                          onClick={() => openDeleteConfirmation(project)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Delete project"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </div>

                    {/* Issue Statistics */}
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Tổng issues:</span>
                        <span className="text-2xl font-bold dark:text-white">{project.totalIssues}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg">
                          <p className="text-[10px] text-yellow-700 dark:text-yellow-400 font-bold uppercase tracking-wide mb-1">Open</p>
                          <p className="text-xl font-bold text-yellow-600 dark:text-yellow-500">{project.openIssues}</p>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg">
                          <p className="text-[10px] text-green-700 dark:text-green-400 font-bold uppercase tracking-wide mb-1">Resolved</p>
                          <p className="text-xl font-bold text-green-600 dark:text-green-500">{project.resolvedIssues}</p>
                        </div>
                      </div>

                      {(project.criticalIssues > 0 || project.highIssues > 0) && (
                        <div className="flex gap-2 flex-wrap">
                          {project.criticalIssues > 0 && (
                            <span className="text-[10px] bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-1 rounded font-bold border border-red-500/20">
                              {project.criticalIssues} Critical
                            </span>
                          )}
                          {project.highIssues > 0 && (
                            <span className="text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-1 rounded font-bold border border-orange-500/20">
                              {project.highIssues} High
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Resolution Rate Progress Bar */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Resolution Rate</span>
                        <span className="text-xs font-bold dark:text-white">{Math.round(project.resolutionRate)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary h-2 rounded-full shadow-sm shadow-primary/50 transition-all"
                          style={{ width: `${project.resolutionRate}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Pending Issues Per File Section */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1 h-3 bg-primary rounded-full"></span>
              Pending Issues Per File
            </h2>
            <span className="text-xs text-primary font-bold cursor-pointer hover:underline uppercase tracking-tighter">
              Báo cáo chi tiết
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse">
                  <div className="h-20"></div>
                </div>
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              Chưa có dữ liệu. Hãy import file để bắt đầu.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {files.map((file, index) => {
                const colorClass = getSeverityColor(file.progress);
                const iconMap: Record<string, string> = {
                  red: 'report',
                  orange: 'warning',
                  yellow: 'schedule',
                  green: 'check_circle',
                  blue: 'info'
                };

                return (
                  <div key={file._id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-primary/40 dark:hover:border-primary/40 hover:shadow-md transition-all group dark:shadow-slate-900/50">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-2 bg-${colorClass}-500/10 text-${colorClass}-500 rounded-lg group-hover:scale-110 transition-transform`}>
                        <span className="material-symbols-outlined">{iconMap[colorClass] || 'info'}</span>
                      </div>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-600">
                        {file.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate uppercase tracking-tight">
                      {file.fileName}
                    </p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-bold dark:text-white">{file.pendingIssues}</span>
                      <span className="text-xs text-slate-500 font-medium">
                        / {file.totalIssues} issues
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-4 overflow-hidden">
                      <div 
                        className={`bg-${colorClass}-500 h-1.5 rounded-full shadow-sm shadow-${colorClass}-500/50`}
                        style={{ width: `${file.progress}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Calendar and Events */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Calendar */}
            <Calendar />

            {/* Event Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 p-4 rounded-xl flex items-center gap-4 hover:bg-primary/10 transition-colors cursor-pointer group">
                <div className="w-10 h-10 rounded-lg bg-primary text-white flex items-center justify-center shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined">event_note</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold dark:text-white">Kiểm tra định kỳ</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Dự kiến: 12/02, 09:00 AM</p>
                </div>
              </div>

              <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer group">
                <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined">history</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold dark:text-white">Lần cuối Import</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {files.length > 0 ? `${files.reduce((sum, f) => sum + f.totalIssues, 0)} hàng đã được xử lý` : 'Chưa có dữ liệu'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Quick Import and Notifications */}
          <div className="space-y-6">
            {/* Quick Import */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary">cloud_upload</span>
                  <h3 className="font-bold dark:text-white">Nhập dữ liệu nhanh</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                  Import dữ liệu từ Google Sheets. Mỗi project có thể có nhiều file.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter block mb-1.5 ml-1">
                      Tên Project *
                    </label>
                    <input
                      className="w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg text-sm px-4 py-2.5 focus:ring-primary focus:border-primary transition-all dark:text-white placeholder:text-slate-500 shadow-sm"
                      placeholder="VD: Blockchain Dashboard"
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter block mb-1.5 ml-1">
                      Đường dẫn Google Sheets *
                    </label>
                    <input
                      className="w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg text-sm px-4 py-2.5 focus:ring-primary focus:border-primary transition-all dark:text-white placeholder:text-slate-500 shadow-sm"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      type="text"
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter block mb-1.5 ml-1">
                      Tên Sheet (tuỳ chọn)
                    </label>
                    <input
                      className="w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg text-sm px-4 py-2.5 focus:ring-primary focus:border-primary transition-all dark:text-white placeholder:text-slate-500 shadow-sm"
                      placeholder="Sheet1"
                      type="text"
                      value={sheetName}
                      onChange={(e) => setSheetName(e.target.value)}
                    />
                  </div>
                  <button 
                    className="w-full bg-primary hover:bg-blue-600 text-white font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleImport}
                    disabled={importing || !projectName.trim() || !googleSheetUrl.trim()}
                  >
                    {importing ? (
                      <>
                        <span className="material-symbols-outlined text-lg animate-spin">refresh</span>
                        Đang import...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">auto_fix_high</span>
                        Bắt đầu Import
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest">
                    Hoạt động gần đây
                  </h4>
                  <ul className="space-y-4">
                    {files.slice(0, 3).map(file => (
                      <li key={file._id} className="flex items-start gap-3 group cursor-default">
                        <span className={`w-2 h-2 rounded-full ${
                          file.status === 'completed' ? 'bg-green-500' : 
                          file.status === 'in-progress' ? 'bg-yellow-500' : 
                          'bg-blue-500'
                        } mt-1.5 shrink-0 ring-4 ring-${
                          file.status === 'completed' ? 'green' : 
                          file.status === 'in-progress' ? 'yellow' : 
                          'blue'
                        }-500/10 shadow-sm`}></span>
                        <div>
                          <p className="text-xs font-semibold dark:text-white group-hover:text-primary transition-colors">
                            {file.fileName}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                            {file.totalIssues} issues - {file.progress}% hoàn tất
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="font-bold text-lg dark:text-white">Thông báo mới</h3>
                <button className="flex items-center gap-1 text-xs text-primary font-bold uppercase tracking-widest hover:opacity-80 transition-opacity">
                  Xem tất cả
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>

              <div className="p-6 space-y-4">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse"></div>
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <p className="text-center text-slate-500 py-4">Không có thông báo mới</p>
                ) : (
                  notifications.map(notification => (
                    <div key={notification._id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
                      <div className={`w-2 h-2 rounded-full ${
                        notification.type === 'error' ? 'bg-red-500' :
                        notification.type === 'warning' ? 'bg-yellow-500' :
                        notification.type === 'success' ? 'bg-green-500' :
                        'bg-blue-500'
                      } mt-1.5 shrink-0 ${!notification.isRead ? 'animate-pulse' : ''}`}></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold dark:text-white truncate">
                          {notification.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-2xl">warning</span>
              </div>
              <h3 className="text-lg font-bold dark:text-white">Xóa Project</h3>
            </div>
            
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              Bạn có chắc chắn muốn xóa project <strong>"{deleteConfirmation.projectName}"</strong>?
            </p>
            
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800 dark:text-red-300 font-semibold mb-2">
                Hành động này sẽ xóa:
              </p>
              <ul className="space-y-1 text-sm text-red-700 dark:text-red-400">
                <li>• {deleteConfirmation.fileCount} files</li>
                <li>• {deleteConfirmation.issueCount} issues</li>
                <li className="font-bold">• Không thể hoàn tác!</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeDeleteConfirmation}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteProject}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Xóa Project
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
