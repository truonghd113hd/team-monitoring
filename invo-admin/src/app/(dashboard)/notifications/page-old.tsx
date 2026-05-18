export default function NotificationsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800/50 overflow-x-auto max-w-full">
          <button className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 shadow-sm text-primary whitespace-nowrap">
            Tất cả
          </button>
          <button className="px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors whitespace-nowrap">
            Chưa đọc
          </button>
          <button className="px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors whitespace-nowrap">
            Issues
          </button>
          <button className="px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors whitespace-nowrap">
            Hệ thống
          </button>
        </div>
        <button className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-red-500 transition-colors">
          <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
          Xóa gần đây
        </button>
      </div>

      <div className="space-y-10">
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-5 px-1">Hoạt động gần đây</h2>
          <div className="space-y-3">
            <div className="group relative flex items-start gap-4 p-5 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">error_outline</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    Cảnh báo tính toàn vẹn dữ liệu
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">Vừa xong</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                  Phát hiện sai lệch checksum trong tệp 'baocao_quy2_v2.pdf'. Yêu cầu xác minh thủ công từ quản trị viên trước khi xử lý.
                </p>
                <div className="flex gap-2">
                  <button className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white text-[11px] font-bold rounded-lg transition-colors">
                    Giải quyết ngay
                  </button>
                  <button className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                    Chi tiết
                  </button>
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex gap-1 items-center ml-4 transition-opacity shrink-0">
                <button className="p-2 text-slate-400 hover:text-primary rounded-lg hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all">
                  <span className="material-symbols-outlined text-[20px]">check</span>
                </button>
                <button className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all">
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>
            </div>

            <div className="group relative flex items-start gap-4 p-5 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">event_repeat</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Sắp tới: Họp Team</h3>
                  <span className="text-[11px] text-slate-500 font-medium">12 phút trước</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Cuộc họp đồng bộ hóa vận hành hàng tuần sẽ bắt đầu sau 30 phút tại Phòng B. Vui lòng mang theo nhật ký cập nhật.
                </p>
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex gap-1 items-center ml-4 transition-opacity shrink-0">
                <button className="p-2 text-slate-400 hover:text-primary rounded-lg hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all">
                  <span className="material-symbols-outlined text-[20px]">check</span>
                </button>
                <button className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all">
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-5 px-1">Sớm hơn hôm nay</h2>
          <div className="space-y-3">
            <div className="group relative flex items-start gap-4 p-5 bg-white dark:bg-slate-800/20 border border-slate-200 dark:border-slate-800/50 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700/50 text-slate-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">upgrade</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">Triển khai hệ thống v4.2.0</h3>
                  <span className="text-[11px] text-slate-400">4 giờ trước</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-500 leading-relaxed">
                  Tối ưu hóa lập chỉ mục cơ sở dữ liệu hiện đã hoạt động trên tất cả các nút sản xuất. Độ trễ giảm 15%.
                </p>
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex gap-1 items-center ml-4 transition-opacity shrink-0">
                <button className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>
            </div>

            <div className="group relative flex items-start gap-4 p-5 bg-white dark:bg-slate-800/20 border border-slate-200 dark:border-slate-800/50 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">verified_user</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">Sao lưu thành công</h3>
                  <span className="text-[11px] text-slate-400">5:00 AM</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-500 leading-relaxed">
                  Sao lưu cơ sở dữ liệu hàng ngày đã hoàn thành mà không có lỗi. Dung lượng tệp: 4.2GB.
                </p>
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex gap-1 items-center ml-4 transition-opacity shrink-0">
                <button className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>
            </div>

            <div className="group relative flex items-start gap-4 p-5 bg-white dark:bg-slate-800/20 border border-slate-200 dark:border-slate-800/50 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700/50 text-slate-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">security</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">Phát hiện đăng nhập mới</h3>
                  <span className="text-[11px] text-slate-400">9:12 AM</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-500 leading-relaxed">
                  Đăng nhập thành công từ Chrome trên Mac OS (Hà Nội, VN). Vị trí đã được xác minh.
                </p>
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex gap-1 items-center ml-4 transition-opacity shrink-0">
                <button className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500">
        <p className="text-xs font-medium">Đang hiển thị 5 trên tổng số 142 sự kiện</p>
        <div className="flex items-center gap-1">
          <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 transition-colors" disabled>
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
          <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary text-white font-bold text-xs shadow-md shadow-primary/20">1</button>
          <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors">2</button>
          <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors">3</button>
          <span className="px-2 text-xs">...</span>
          <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors">29</button>
          <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  )
}