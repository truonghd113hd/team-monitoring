"use client"
import { useState, useEffect } from "react"
import { notificationsApi } from "@/services/api"
import type { Notification } from "@/types/api"

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'issues' | 'system'>('all')

  useEffect(() => {
    fetchNotifications()
  }, [filter])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const filters: any = {}
      if (filter === 'unread') {
        filters.isRead = false
      }
      const data = await notificationsApi.getAll(filters)
      
      // Filter by type if needed
      let filteredData = data
      if (filter === 'issues') {
        filteredData = data.filter(n => n.type === 'error' || n.type === 'warning')
      } else if (filter === 'system') {
        filteredData = data.filter(n => n.type === 'info' || n.type === 'success')
      }
      
      setNotifications(filteredData)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id)
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, isRead: true } : n)
      )
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await notificationsApi.delete(id)
      setNotifications(prev => prev.filter(n => n._id !== id))
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'error': return { icon: 'error_outline', color: 'red' }
      case 'warning': return { icon: 'warning', color: 'yellow' }
      case 'success': return { icon: 'check_circle', color: 'green' }
      default: return { icon: 'info', color: 'blue' }
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return 'Vừa xong'
    if (minutes < 60) return `${minutes} phút trước`
    if (hours < 24) return `${hours} giờ trước`
    return `${days} ngày trước`
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800/50 overflow-x-auto max-w-full">
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
              filter === 'all' 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            Tất cả
          </button>
          <button 
            onClick={() => setFilter('unread')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
              filter === 'unread' 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            Chưa đọc
          </button>
          <button 
            onClick={() => setFilter('issues')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
              filter === 'issues' 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            Issues
          </button>
          <button 
            onClick={() => setFilter('system')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
              filter === 'system' 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            Hệ thống
          </button>
        </div>
        <button 
          onClick={handleMarkAllAsRead}
          className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">done_all</span>
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-slate-400">notifications_off</span>
          </div>
          <p className="text-slate-500">Không có thông báo nào</p>
        </div>
      ) : (
        <div className="space-y-10">
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-5 px-1">Hoạt động gần đây</h2>
            <div className="space-y-3">
              {notifications.map((notification) => {
                const { icon, color } = getNotificationIcon(notification.type)
                return (
                  <div 
                    key={notification._id} 
                    className={`group relative flex items-start gap-4 p-5 rounded-xl transition-all hover:shadow-lg ${
                      !notification.isRead 
                        ? `bg-${color}-500/5 dark:bg-${color}-500/10 border border-${color}-500/20 hover:border-${color}-500/40`
                        : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      <div className={`w-12 h-12 rounded-xl bg-${color}-500/10 text-${color}-500 flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-[24px]">{icon}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          {notification.title}
                          {!notification.isRead && (
                            <span className={`w-2 h-2 rounded-full bg-${color}-500 animate-pulse`}></span>
                          )}
                        </h3>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {formatTime(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                        {notification.message}
                      </p>
                      <div className="flex gap-2">
                        {!notification.isRead && (
                          <button 
                            onClick={() => handleMarkAsRead(notification._id)}
                            className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white text-[11px] font-bold rounded-lg transition-colors"
                          >
                            Đánh dấu đã đọc
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(notification._id)}
                          className="px-4 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
