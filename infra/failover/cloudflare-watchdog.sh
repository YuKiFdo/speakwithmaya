#!/usr/bin/env bash
# ==============================================================================
# Maya AI - Automated Cloudflare Failover Watchdog Daemon
# Runs on Leaseweb Server (172.255.209.238)
#
# Continuously monitors Azure Primary (20.198.240.185) health.
# If Azure fails 3 consecutive checks (45s), automatically steers Cloudflare
# DNS records to Leaseweb.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/watchdog.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "[$(date)] ❌ Configuration file $ENV_FILE not found. Run fetch-cf-record-ids.sh first."
  exit 1
fi

source "$ENV_FILE"

CHECK_INTERVAL=15               # Check every 15 seconds
FAIL_THRESHOLD=${FAIL_THRESHOLD:-3} # 3 consecutive failures = 45s detection
AUTO_FAILBACK="${AUTO_FAILBACK:-false}" # Default to safe manual failback
STABLE_FAILBACK_THRESHOLD=20    # 20 checks * 15s = 5 min of stability required if auto failback enabled

CONSECUTIVE_FAILURES=0
AZURE_STABLE_COUNT=0
CURRENT_ACTIVE_TARGET="primary"

echo "========================================================"
echo "👀 Maya AI Automated Cloudflare Watchdog Daemon Started"
echo "Target Primary: $PRIMARY_HEALTH_URL"
echo "Failover Target: $BACKUP_IP (Leaseweb)"
echo "Check Interval: ${CHECK_INTERVAL}s | Threshold: ${FAIL_THRESHOLD} checks"
echo "========================================================"

while true; do
  # Probe Azure Primary health endpoint
  HEALTH_OK=false
  if RESPONSE=$(curl -s -f --connect-timeout 4 --max-time 6 "$PRIMARY_HEALTH_URL" 2>/dev/null); then
    if echo "$RESPONSE" | grep -q '"status":"ok"'; then
      HEALTH_OK=true
    fi
  fi

  if [ "$HEALTH_OK" = true ]; then
    if [ "$CONSECUTIVE_FAILURES" -gt 0 ]; then
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] ℹ️ Azure probe recovered (was failed $CONSECUTIVE_FAILURES times)."
      CONSECUTIVE_FAILURES=0
    fi

    # If we are currently routed to backup, track Azure recovery stability
    if [ "$CURRENT_ACTIVE_TARGET" == "backup" ]; then
      AZURE_STABLE_COUNT=$((AZURE_STABLE_COUNT + 1))
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🟢 Azure is BACK ONLINE. Stability count: $AZURE_STABLE_COUNT / $STABLE_FAILBACK_THRESHOLD"

      if [ "$AUTO_FAILBACK" == "true" ] && [ "$AZURE_STABLE_COUNT" -ge "$STABLE_FAILBACK_THRESHOLD" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔄 Azure stable for 5 minutes. Executing automatic failback to Azure!"
        bash "${SCRIPT_DIR}/switch-to-azure.sh" || true
        CURRENT_ACTIVE_TARGET="primary"
        AZURE_STABLE_COUNT=0
      elif [ "$AZURE_STABLE_COUNT" -eq 1 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔔 ALERT: Azure Primary is UP and healthy! You can run './switch-to-azure.sh' to restore traffic when ready."
      fi
    fi

  else
    # Health check failed
    CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
    AZURE_STABLE_COUNT=0
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ Primary Azure health probe FAILED ($CONSECUTIVE_FAILURES / $FAIL_THRESHOLD)..."

    if [ "$CONSECUTIVE_FAILURES" -ge "$FAIL_THRESHOLD" ] && [ "$CURRENT_ACTIVE_TARGET" != "backup" ]; then
      echo "========================================================"
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 CRITICAL: Azure is DOWN ($CONSECUTIVE_FAILURES failures)."
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚀 INITIATING AUTOMATIC FAILOVER TO LEASEWEB ($BACKUP_IP)..."
      echo "========================================================"
      
      bash "${SCRIPT_DIR}/switch-to-leaseweb.sh" || true
      CURRENT_ACTIVE_TARGET="backup"
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Failover completed. All traffic is now handled by Leaseweb."
    fi
  fi

  sleep "$CHECK_INTERVAL"
done

