# Invo Admin Backend

Backend API cho Invo Admin Dashboard - hệ thống quản lý issues và projects với TypeScript, Express, MongoDB.

## Tính năng

- ✅ **Quản lý Projects**: CRUD operations cho projects
- ✅ **Quản lý Files**: Tracking files và issues của từng file
- ✅ **Quản lý Issues**: Listing, filtering issues theo file/status/severity
- ✅ **Calendar Notes**: Tạo/sửa/xóa notes theo ngày
- ✅ **Notifications**: Hệ thống thông báo real-time
- ✅ **Google Sheets Sync**: Đồng bộ data từ Google Sheets
- ✅ **Statistics**: Thống kê tổng quan về projects và issues

## Cài đặt

```bash
# Install dependencies
npm install

# Copy .env.example to .env và config
cp .env.example .env

# Đặt file credentials.json vào root folder
# (Service Account JSON từ Google Cloud Console)

# Start MongoDB (nếu chưa có)
# macOS: brew services start mongodb-community
# hoặc: mongod

# Run development server
npm run dev

# Build production
npm run build

# Start production server
npm start
```

## Google Sheets Authentication

Backend sử dụng Google Sheets API với Service Account authentication:

1. **Tạo Service Account** trên [Google Cloud Console](https://console.cloud.google.com)
   - Tạo project mới hoặc chọn existing project
   - Enable Google Sheets API
   - Tạo Service Account và download JSON credentials
   
2. **Đặt credentials.json** vào root folder của backend

3. **Share Google Sheet** với service account email (từ credentials.json)
   - Mở Google Sheet cần sync
   - Click "Share" 
   - Thêm email: `{client_email}` từ credentials.json
   - Cấp quyền "Viewer"

4. **Format Google Sheets URL**: 
   ```
   https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit
   ```

## API Endpoints

### Projects
- `GET /api/projects` - Lấy danh sách projects (có stats)
- `GET /api/projects/:id` - Lấy chi tiết project
- `POST /api/projects` - Tạo project mới
- `PUT /api/projects/:id` - Cập nhật project
- `DELETE /api/projects/:id` - Xóa project

### Files
- `GET /api/files?projectId=xxx` - Lấy danh sách files
- `GET /api/files/:id` - Lấy chi tiết file
- `PUT /api/files/:id` - Cập nhật file

### Issues
- `GET /api/issues?projectId=xxx&fileId=xxx&status=open` - Lấy issues với filters
- `GET /api/issues/:id` - Lấy chi tiết issue
- `PUT /api/issues/:id` - Cập nhật issue
- `DELETE /api/issues/:id` - Xóa issue

### Notes
- `GET /api/notes/month?year=2026&month=2` - Lấy notes của tháng
- `GET /api/notes/:date` - Lấy note theo ngày (YYYY-MM-DD)
- `POST /api/notes` - Tạo/cập nhật note
- `DELETE /api/notes/:date` - Xóa note

### Notifications
- `GET /api/notifications?isRead=false&limit=50` - Lấy notifications
- `PUT /api/notifications/:id/read` - Đánh dấu đã đọc
- `PUT /api/notifications/read-all` - Đánh dấu tất cả đã đọc
- `DELETE /api/notifications/:id` - Xóa notification

### Sync
- `POST /api/sync/google-sheets` - Đồng bộ từ Google Sheets (sử dụng credentials.json)
  ```json
  {
    "projectName": "Project ABC",
    "googleSheetUrl": "https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit",
    "sheetName": "Sheet1"  // Optional: tên sheet/tab cụ thể
  }
  ```
  
  **Lưu ý**: 
  - Google Sheet phải được share với service account email
  - Backend đọc trực tiếp từ API sử dụng credentials.json
  - Nếu không có `sheetName`, sẽ đọc sheet đầu tiên

### Stats
- `GET /api/stats?projectId=xxx` - Lấy thống kê tổng quan

### Health Check
- `GET /api/health` - Kiểm tra trạng thái server

## Database Schema

### Project
```typescript
{
  name: string;
  description: string;
  googleSheetUrl: string;
  status: 'active' | 'inactive' | 'archived';
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### File
```typescript
{
  projectId: ObjectId;
  fileName: string;
  filePath: string;
  totalIssues: number;
  pendingIssues: number;
  resolvedIssues: number;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  progress: number;
  lastUpdated: Date;
  createdAt: Date;
}
```

### Issue
```typescript
{
  projectId: ObjectId;
  fileId: ObjectId;
  issueId: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  assignee: string;
  lineNumber: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date;
}
```

### Note
```typescript
{
  projectId: ObjectId;
  date: string; // YYYY-MM-DD
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Notification
```typescript
{
  projectId: ObjectId;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  isRead: boolean;
  metadata: object;
  createdAt: Date;
}
```

## Google Sheets Format

CSV từ Google Sheets cần có các cột:
- `File` hoặc `FileName` - Tên file
- `IssueId` hoặc `ID` - ID của issue
- `Title` - Tiêu đề issue
- `Description` - Mô tả (optional)
- `Status` - open, in-progress, resolved, closed
- `Severity` - low, medium, high, critical
- `Assignee` - Người được assign (optional)
- `Line` - Số dòng (optional)

## Tech Stack

- **TypeScript** - Type-safe development
- **Express** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **Google Sheets API (googleapis)** - Direct Google Sheets integration với service account
- **date-fns** - Date utilities

## Docker

### Build image

```bash
docker build -t invo-admin-backend .
```

### Run container (standalone)

```bash
docker run -d \
  --name invo-backend \
  -p 5000:5000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/invo-admin \
  -e NODE_ENV=production \
  -v $(pwd)/credentials.json:/app/credentials.json:ro \
  --env-file .env \
  invo-admin-backend
```

### Run with docker-compose (recommended)

From the root of the monorepo:

```bash
docker compose up -d
```

> **Note**: `credentials.json` is mounted as a read-only volume at runtime. It is never baked into the image.

## Environment Variables

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/invo-admin
NODE_ENV=development
```
