# Note Notification Job

Standalone job for checking and sending note notifications.

## Usage

### Run notification check manually
```bash
npm run job:note-notifications
```

### Run cache cleanup manually
```bash
npm run job:cleanup-cache
```

## Automation with Cron

### On Linux/macOS

Add to crontab (`crontab -e`):

```bash
# Run note notifications every hour
0 * * * * cd /path/to/invo-admin-backend && npm run job:note-notifications >> logs/note-notifications.log 2>&1

# Clean up cache daily at midnight
0 0 * * * cd /path/to/invo-admin-backend && npm run job:cleanup-cache >> logs/cache-cleanup.log 2>&1
```

### On Windows

Use Task Scheduler:

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (hourly for notifications, daily at midnight for cleanup)
4. Action: Start a program
   - Program: `npm`
   - Arguments: `run job:note-notifications`
   - Start in: `C:\path\to\invo-admin-backend`

## How it works

The job:
1. Connects to MongoDB
2. Checks notes for the next 3 days (today, tomorrow, day after tomorrow)
3. Creates notifications for notes that don't have notifications yet
4. Uses cache to prevent duplicate notifications (one per day per note)
5. Exits with code 0 on success, 1 on failure

## Environment Variables

Make sure `.env` file is configured with:
- `MONGODB_URI`: MongoDB connection string
- `PORT`: (optional) Server port

## Logs

- Success: Exits with code 0
- Failure: Exits with code 1, error logged to stderr

0 14 * * * cd /Users/saber/saber/work/team-project/blockchain-team-dashboard/invo-admin-backend && npm run job:note-notifications-end-day >> /Users/saber/saber/work/team-project/blockchain-team-dashboard/invo-admin-backend/logs/note-notifications-end-day.log 2>&1