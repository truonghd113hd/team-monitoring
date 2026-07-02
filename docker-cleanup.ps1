$logFile = "$PSScriptRoot\docker-cleanup.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

function Log($msg) {
    "$timestamp  $msg" | Tee-Object -FilePath $logFile -Append
}

Log "=== Docker cleanup started ==="

# Stop containers
Log "Stopping containers..."
docker compose -f "$PSScriptRoot\docker-compose.yml" down

# Remove stopped containers, dangling images, unused networks
Log "Pruning containers, images, networks..."
docker container prune -f
docker image prune -f
docker network prune -f

# Remove build cache (biggest space consumer on C:)
Log "Pruning build cache..."
docker builder prune -f

Log "Disk C: free space after cleanup:"
(Get-PSDrive C).Free / 1GB | ForEach-Object { Log ("  {0:N2} GB free" -f $_) }

# Restart containers
Log "Starting containers..."
docker compose -f "$PSScriptRoot\docker-compose.yml" up -d

Log "=== Done ==="
