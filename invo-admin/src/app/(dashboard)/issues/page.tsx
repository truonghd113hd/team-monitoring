"use client"
import { useState, useEffect } from "react"
import Header from "@/components/header"
import { filesApi, issuesApi } from "@/services/api"
import type { File, Issue } from "@/types/api"

export default function IssuesPage() {
  const [files, setFiles] = useState<File[]>([])
  const [selectedFileId, setSelectedFileId] = useState<string>("")
  const [issues, setIssues] = useState<Issue[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [systemStatusFilter, setSystemStatusFilter] = useState<string>("all")
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("createdAt")
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    fileId: string | null;
    fileName: string | null;
    issueCount: number;
  }>({
    isOpen: false,
    fileId: null,
    fileName: null,
    issueCount: 0
  })

  useEffect(() => {
    fetchFiles()
  }, [])

  useEffect(() => {
    if (selectedFileId) {
      fetchIssues()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFileId, systemStatusFilter, severityFilter, sortBy])

  const fetchFiles = async () => {
    try {
      const data = await filesApi.getAll()
      setFiles(data)
      if (data.length > 0) {
        setSelectedFileId(data[0]._id)
      }
    } catch (error) {
      console.error('Failed to fetch files:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchIssues = async () => {
    try {
      setLoading(true)
      const filters: any = { fileId: selectedFileId }
      if (systemStatusFilter !== "all") filters.systemStatus = systemStatusFilter
      if (severityFilter !== "all") filters.severity = severityFilter
      if (sortBy) filters.sortBy = sortBy
      
      const data = await issuesApi.getAll(filters)
      setIssues(data)
    } catch (error) {
      console.error('Failed to fetch issues:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteIssue = async (issueId: string) => {
    try {
      await issuesApi.complete(issueId)
      fetchIssues() // Refresh issues list
      fetchFiles() // Refresh file statistics
    } catch (error) {
      console.error('Failed to complete issue:', error)
    }
  }

  const openDeleteConfirmation = () => {
    const file = files.find(f => f._id === selectedFileId)
    if (!file) return

    setDeleteConfirmation({
      isOpen: true,
      fileId: file._id,
      fileName: file.fileName,
      issueCount: file.totalIssues
    })
  }

  const closeDeleteConfirmation = () => {
    setDeleteConfirmation({
      isOpen: false,
      fileId: null,
      fileName: null,
      issueCount: 0
    })
  }

  const handleDeleteFile = async () => {
    if (!deleteConfirmation.fileId) return

    try {
      const result = await filesApi.delete(deleteConfirmation.fileId)
      
      closeDeleteConfirmation()
      await fetchFiles() // Refresh files list
      setSelectedFileId('') // Clear selection
      setIssues([]) // Clear issues
      
      alert(`Đã xóa file "${deleteConfirmation.fileName}" (${result.deletedIssues} issues)`)
    } catch (error: any) {
      console.error('Delete failed:', error)
      alert(`Xóa thất bại: ${error.message || 'Unknown error'}`)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      open: 'bg-red-500/10 text-red-500 border-red-200 dark:border-red-800',
      'in-progress': 'bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:border-yellow-800',
      resolved: 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-800',
      closed: 'bg-slate-500/10 text-slate-500 border-slate-200 dark:border-slate-700'
    }
    return styles[status as keyof typeof styles] || styles.open
  }

  const getSystemStatusBadge = (systemStatus: string) => {
    const styles = {
      open: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800',
      update: 'bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800',
      progress: 'bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:border-yellow-800',
      completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800'
    }
    return styles[systemStatus as keyof typeof styles] || styles.open
  }

  const getSeverityColor = (severity: string) => {
    const colors = {
      critical: 'text-red-600',
      high: 'text-orange-500',
      medium: 'text-yellow-500',
      low: 'text-blue-500'
    }
    return colors[severity as keyof typeof colors] || colors.medium
  }

  const selectedFile = files.find(f => f._id === selectedFileId)

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
            <div className="flex items-center gap-3">
              <div className="relative min-w-[340px]">
                <select 
                  value={selectedFileId}
                  onChange={(e) => setSelectedFileId(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:border-primary focus:ring-0 appearance-none cursor-pointer font-medium text-slate-700 dark:text-slate-200"
                >
                  {files.map(file => (
                    <option key={file._id} value={file._id}>
                      {file.fileName} ({file.totalIssues} issues)
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">expand_more</span>
              </div>
              {selectedFile && selectedFile.sheetUrl && (
                <a
                  href={selectedFile.sheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
                  title="Open Google Sheet"
                >
                  <span className="material-symbols-outlined text-lg">open_in_new</span>
                  Open Sheet
                </a>
              )}
              {selectedFile && (
                <button
                  onClick={openDeleteConfirmation}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
                  title="Delete file and all issues"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                  Delete File
                </button>
              )}
            </div>
          </div>
        </div>

        {selectedFile && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Total Issues</p>
              <p className="text-2xl font-bold dark:text-white">{selectedFile.totalIssues}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Pending</p>
              <p className="text-2xl font-bold text-yellow-500">{selectedFile.pendingIssues}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Resolved</p>
              <p className="text-2xl font-bold text-green-500">{selectedFile.resolvedIssues}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Progress</p>
              <p className="text-2xl font-bold text-primary">{selectedFile.progress}%</p>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-lg dark:text-white">Issues List</h3>
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded">
                {issues.length}
              </span>
            </div>
            
            <div className="flex gap-2">
              <select
                value={systemStatusFilter}
                onChange={(e) => setSystemStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium"
              >
                <option value="all">All System Status</option>
                <option value="open">Open</option>
                <option value="update">Update</option>
                <option value="progress">Progress</option>
                <option value="completed">Completed</option>
              </select>
              
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium"
              >
                <option value="all">All Severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium"
              >
                <option value="createdAt">Sort: Date (Newest)</option>
                <option value="issueId">Sort: Issue ID (Asc)</option>
                <option value="issueId_desc">Sort: Issue ID (Desc)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="w-12 px-6 py-3"></th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Issue ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    System Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Assignee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-slate-500">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : issues.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      No issues found
                    </td>
                  </tr>
                ) : (
                  issues.map((issue) => (
                    <tr
                      key={issue._id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(issue._id)}
                          onChange={() => toggleSelect(issue._id)}
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono font-semibold text-primary">
                          {issue.issueId}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium dark:text-white">{issue.title}</p>
                          {issue.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                              {issue.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(issue.status)}`}>
                          {issue.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getSystemStatusBadge(issue.systemStatus)}`}>
                          {issue.systemStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-bold uppercase ${getSeverityColor(issue.severity)}`}>
                          {issue.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {issue.assignee || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleCompleteIssue(issue._id)}
                          disabled={issue.systemStatus === 'completed'}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            issue.systemStatus === 'completed'
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
                              : issue.systemStatus === 'progress'
                              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                              : 'bg-blue-500 text-white hover:bg-blue-600'
                          }`}
                        >
                          {issue.systemStatus === 'completed' ? 'Completed' : issue.systemStatus === 'progress' ? 'Complete' : 'Start'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
              <h3 className="text-lg font-bold dark:text-white">Xóa File</h3>
            </div>
            
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              Bạn có chắc chắn muốn xóa file <strong>"{deleteConfirmation.fileName}"</strong>?
            </p>
            
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800 dark:text-red-300 font-semibold mb-2">
                Hành động này sẽ xóa:
              </p>
              <ul className="space-y-1 text-sm text-red-700 dark:text-red-400">
                <li>• {deleteConfirmation.issueCount} issues liên quan</li>
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
                onClick={handleDeleteFile}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Xóa File
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
