"use client"
import { useState, useEffect } from "react"
import { notesApi } from "@/services/api"

interface Note {
  date: string // Format: YYYY-MM-DD
  content: string
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [editingNote, setEditingNote] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Fetch notes for current month
  useEffect(() => {
    fetchMonthNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  const fetchMonthNotes = async () => {
    try {
      setLoading(true)
      const monthNotes = await notesApi.getMonthNotes(year, month + 1)
      setNotes(monthNotes)
    } catch (error) {
      console.error('Failed to fetch notes:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get first day of month (0 = Sunday, 6 = Saturday)
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  
  // Get number of days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  // Get number of days in previous month
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const monthNames = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
  ]

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDate(null)
    setIsEditing(false)
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDate(null)
    setIsEditing(false)
  }

  const formatDateKey = (y: number, m: number, d: number) => {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  const handleDayClick = (day: number) => {
    const dateKey = formatDateKey(year, month, day)
    setSelectedDate(dateKey)
    
    const existingNote = notes.find(n => n.date === dateKey)
    setEditingNote(existingNote?.content || "")
    setIsEditing(true)
  }

  const handleSaveNote = async () => {
    if (!selectedDate) return

    try {
      setLoading(true)
      
      if (editingNote.trim()) {
        // Create or update note via API
        await notesApi.upsert({
          date: selectedDate,
          content: editingNote
        })
        
        // Update local state
        const existingNoteIndex = notes.findIndex(n => n.date === selectedDate)
        if (existingNoteIndex >= 0) {
          const updatedNotes = [...notes]
          updatedNotes[existingNoteIndex] = { date: selectedDate, content: editingNote }
          setNotes(updatedNotes)
        } else {
          setNotes([...notes, { date: selectedDate, content: editingNote }])
        }
      } else {
        // Delete note if content is empty
        const existingNote = notes.find(n => n.date === selectedDate)
        if (existingNote) {
          await notesApi.delete(selectedDate)
          setNotes(notes.filter(n => n.date !== selectedDate))
        }
      }

      setIsEditing(false)
      setSelectedDate(null)
      setEditingNote("")
    } catch (error) {
      console.error('Failed to save note:', error)
      alert('Không thể lưu ghi chú. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setSelectedDate(null)
    setEditingNote("")
  }

  const hasNote = (dateKey: string) => {
    return notes.some(n => n.date === dateKey)
  }

  const isToday = (day: number) => {
    const today = new Date()
    return today.getDate() === day && 
           today.getMonth() === month && 
           today.getFullYear() === year
  }

  const renderCalendarDays = () => {
    const days = []
    
    // Previous month days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push(
        <div
          key={`prev-${i}`}
          className="aspect-square flex flex-col items-center justify-center rounded-lg text-slate-300 dark:text-slate-600 text-sm"
        >
          {daysInPrevMonth - i}
        </div>
      )
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(year, month, day)
      const isSelected = selectedDate === dateKey
      const isTodayDate = isToday(day)
      const hasNoteForDay = hasNote(dateKey)

      days.push(
        <div
          key={day}
          onClick={() => handleDayClick(day)}
          className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium cursor-pointer transition-all relative ${
            isTodayDate
              ? 'bg-primary text-white font-bold shadow-lg shadow-primary/30 transform scale-105'
              : isSelected
              ? 'bg-primary/20 dark:bg-primary/30 ring-2 ring-primary'
              : hasNoteForDay
              ? 'bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30'
              : 'bg-slate-50 dark:bg-slate-700/40 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          {day}
          {hasNoteForDay && (
            <div className="absolute bottom-1 flex items-center gap-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                isTodayDate ? 'bg-white' : 'bg-amber-500 dark:bg-amber-400'
              }`}></span>
              <span className={`w-1.5 h-1.5 rounded-full ${
                isTodayDate ? 'bg-white' : 'bg-amber-500 dark:bg-amber-400'
              }`}></span>
              <span className={`w-1.5 h-1.5 rounded-full ${
                isTodayDate ? 'bg-white' : 'bg-amber-500 dark:bg-amber-400'
              }`}></span>
            </div>
          )}
        </div>
      )
    }

    // Next month days to fill the grid (complete weeks)
    const totalCells = days.length
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7)
    
    for (let i = 1; i <= remainingCells; i++) {
      days.push(
        <div
          key={`next-${i}`}
          className="aspect-square flex flex-col items-center justify-center rounded-lg text-slate-300 dark:text-slate-600 text-sm"
        >
          {i}
        </div>
      )
    }

    return days
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden dark:shadow-slate-900/50">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-4">
          <h3 className="font-bold text-lg dark:text-white">Lịch hoạt động</h3>
          <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1 border border-slate-200 dark:border-slate-600">
            <button
              onClick={goToPreviousMonth}
              className="p-1 hover:bg-white dark:hover:bg-slate-600 rounded transition-all text-slate-500 dark:text-slate-400"
            >
              <span className="material-symbols-outlined text-sm leading-none">chevron_left</span>
            </button>
            <span className="px-3 text-[11px] font-bold uppercase tracking-tight dark:text-slate-200">
              {monthNames[month]}, {year}
            </span>
            <button
              onClick={goToNextMonth}
              className="p-1 hover:bg-white dark:hover:bg-slate-600 rounded transition-all text-slate-500 dark:text-slate-400"
            >
              <span className="material-symbols-outlined text-sm leading-none">chevron_right</span>
            </button>
          </div>
        </div>
        <button className="flex items-center gap-1.5 text-[11px] text-primary font-bold uppercase tracking-widest hover:opacity-80 transition-opacity">
          <span className="material-symbols-outlined text-sm">add_circle</span>
          Thêm ghi chú
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="p-6">
        <div className="grid grid-cols-7 gap-px mb-2">
          {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day) => (
            <div key={day} className="text-center text-[10px] font-bold text-slate-400 py-2 uppercase">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-3">
          {renderCalendarDays()}
        </div>
      </div>

      {/* Note Editor Modal */}
      {isEditing && selectedDate && (
        <div className="border-t border-slate-200 dark:border-slate-700 p-6 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                Ghi chú cho ngày {new Date(selectedDate).getDate()}/{month + 1}/{year}
              </label>
              <textarea
                value={editingNote}
                onChange={(e) => setEditingNote(e.target.value)}
                placeholder="Nhập ghi chú của bạn..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary transition-all dark:text-white placeholder:text-slate-400 resize-none"
                rows={4}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleSaveNote}
                disabled={loading}
                className="flex-1 bg-primary hover:bg-blue-600 text-white font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-lg">check</span>
                {loading ? 'Đang lưu...' : 'Accept'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={loading}
                className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-lg">close</span>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
