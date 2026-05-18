import Header from "@/components/header"
import Calendar from "@/components/calendar"

export default function HomePage() {
  return (
    <>
      <Header title="Tổng quan hệ thống" showImport={true} />
      
      <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 - High Priority */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-primary/40 dark:hover:border-primary/40 hover:shadow-md transition-all group dark:shadow-slate-900/50">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-red-500/10 text-red-500 rounded-lg group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined">report</span>
                </div>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-600">
                  2 PHÚT TRƯỚC
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate uppercase tracking-tight">
                inventory_q4_final.csv
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold dark:text-white">42</span>
                <span className="text-xs text-red-500 font-bold flex items-center">
                  <span className="material-symbols-outlined text-xs">trending_up</span>
                  12%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-red-500 h-1.5 rounded-full w-3/4 shadow-sm shadow-red-500/50"></div>
              </div>
            </div>

            {/* Card 2 - Warning */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-primary/40 dark:hover:border-primary/40 hover:shadow-md transition-all group dark:shadow-slate-900/50">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined">warning</span>
                </div>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-600">
                  1 GIỜ TRƯỚC
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate uppercase tracking-tight">
                employee_records.xlsx
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold dark:text-white">18</span>
                <span className="text-xs text-slate-400 font-bold">Mới</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-amber-500 h-1.5 rounded-full w-1/3 shadow-sm shadow-amber-500/50"></div>
              </div>
            </div>

            {/* Card 3 - Processing */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-primary/40 dark:hover:border-primary/40 hover:shadow-md transition-all group dark:shadow-slate-900/50">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-primary/10 text-primary rounded-lg group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined">sync</span>
                </div>
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold border border-primary/20">
                  ĐANG XỬ LÝ
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate uppercase tracking-tight">
                user_analytics_raw.json
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold dark:text-white">124</span>
                <span className="text-xs text-green-500 font-bold flex items-center">
                  <span className="material-symbols-outlined text-xs">trending_down</span>
                  5%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-primary h-1.5 rounded-full w-1/2 shadow-sm shadow-primary/50"></div>
              </div>
            </div>

            {/* Card 4 - Completed */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-primary/40 dark:hover:border-primary/40 hover:shadow-md transition-all group dark:shadow-slate-900/50">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-green-500/10 text-green-500 rounded-lg group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined">verified</span>
                </div>
                <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded font-bold uppercase tracking-tighter border border-green-500/20">
                  Hoàn thành
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate uppercase tracking-tight">
                system_logs_archive.gz
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold dark:text-white">0</span>
                <span className="text-xs text-green-500 font-bold">Tốt</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-green-500 h-1.5 rounded-full w-full shadow-sm shadow-green-500/50"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Calendar and Sidebar Section */}
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
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Dự kiến: 12/10, 09:00 AM</p>
                </div>
              </div>

              <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer group">
                <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined">history</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold dark:text-white">Lần cuối Import</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">2,431 hàng đã được xử lý</p>
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
                  Dán đường dẫn trực tiếp (CSV/JSON) để bắt đầu quá trình nạp dữ liệu tự động.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter block mb-1.5 ml-1">
                      Đường dẫn nguồn
                    </label>
                    <input
                      className="w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg text-sm px-4 py-2.5 focus:ring-primary focus:border-primary transition-all dark:text-white placeholder:text-slate-500 shadow-sm"
                      placeholder="https://cloud.storage/data.csv"
                      type="text"
                    />
                  </div>
                  <button className="w-full bg-primary hover:bg-blue-600 text-white font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined text-lg">auto_fix_high</span>
                    Bắt đầu Import
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest">
                    Hoạt động gần đây
                  </h4>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3 group cursor-default">
                      <span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0 ring-4 ring-green-500/10 dark:ring-green-500/20 shadow-sm shadow-green-500/50"></span>
                      <div>
                        <p className="text-xs font-semibold dark:text-white group-hover:text-primary transition-colors">
                          Đồng bộ Kho hàng
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Hoàn tất 45p trước</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3 group cursor-default">
                      <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0 ring-4 ring-red-500/10 dark:ring-red-500/20 shadow-sm shadow-red-500/50"></span>
                      <div>
                        <p className="text-xs font-semibold dark:text-white group-hover:text-red-400 transition-colors">
                          Patch dữ liệu người dùng
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Lỗi: Hết thời gian kết nối</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50">
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold dark:text-white text-sm">Thông báo mới</h3>
                  <span className="text-[10px] bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 px-2 py-0.5 rounded-full font-bold border border-red-200 dark:border-red-500/30">
                    4 MỚI
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-3 items-center p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                      <span className="material-symbols-outlined text-lg">security</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold dark:text-white truncate">Cảnh báo bảo mật</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        Đăng nhập mới từ Chrome...
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-center p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-sm">
                      <span className="material-symbols-outlined text-lg">storage</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold dark:text-white truncate">Giới hạn lưu trữ</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        DB Production đang ở mức 88%.
                      </p>
                    </div>
                  </div>
                </div>

                <button className="w-full mt-6 text-[10px] font-bold text-primary hover:text-white hover:bg-primary transition-all uppercase tracking-widest text-center border border-primary/30 py-2.5 rounded-lg">
                  Xem tất cả thông báo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
