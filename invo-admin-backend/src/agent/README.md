# Monitoring Agent

Lightweight Node.js agent that collects CPU / RAM / Disk / load metrics and POSTs them to the monitoring backend every 60 seconds.

## Requirements

- Node.js ≥ 18 on the target server
- Token from the dashboard (Host detail page → "Agent Token")

## Quick start

```bash
# 1. Copy agent.js to the target server (or build from agent.ts)
scp invo-admin-backend/src/agent/agent.ts user@server:~/monitor/agent.ts

# On the server:
cd ~/monitor
npm init -y
npm install typescript ts-node

# 2. Set env vars
export MONITOR_URL=https://dashboard.example.com
export AGENT_TOKEN=<token-from-dashboard>

# 3. Run once to test
npx ts-node agent.ts
```

## Run with PM2 (recommended)

```bash
pm2 start "npx ts-node agent.ts" --name monitor-agent \
  --env MONITOR_URL=https://dashboard.example.com \
  --env AGENT_TOKEN=<token>
pm2 save
pm2 startup
```

## Run as systemd timer

Create `/etc/systemd/system/monitor-agent.service`:

```ini
[Unit]
Description=Monitoring Agent

[Service]
Type=simple
WorkingDirectory=/home/ubuntu/monitor
ExecStart=/usr/bin/node -e "$(cat agent-compiled.js)"
Environment=MONITOR_URL=https://dashboard.example.com
Environment=AGENT_TOKEN=<token>
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now monitor-agent
```

## Compiled version (no TypeScript on server)

On your dev machine:

```bash
cd invo-admin-backend
npx tsc src/agent/agent.ts --outDir src/agent/dist --module commonjs --target es2020
scp src/agent/dist/agent.js user@server:~/monitor/
```

Then on the server run `node agent.js` with the env vars above.

## Metrics reported

| Field | Description |
|---|---|
| cpuPct | CPU usage percentage (delta between samples) |
| memPct | Memory usage % |
| memUsedMb / memTotalMb | Memory in MB |
| disk[] | Per-mount: mount, usedPct, usedGb, totalGb |
| loadAvg | 1m / 5m / 15m load averages |
| uptimeSec | Server uptime in seconds |

## Security

- The agent token authorises write-only access to `/api/agent/metrics`.
- Rotate the token anytime from the dashboard (Host detail → "Rotate Token").
- Use HTTPS for MONITOR_URL in production.
