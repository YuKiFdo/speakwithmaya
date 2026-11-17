#!/usr/bin/env bash
# ==============================================================================
# Maya AI - 1-Click Failback to Azure Primary Server (20.198.240.185)
# Usage:
#   bash switch-to-azure.sh
# ==============================================================================

set -euo pipefail

ENV_FILE="$(dirname "$0")/watchdog.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Configuration file $ENV_FILE not found. Run fetch-cf-record-ids.sh first."
  exit 1
fi

source "$ENV_FILE"

TARGET_IP="${PRIMARY_IP:-20.198.240.185}"

echo "========================================================"
echo "🔄 RESTORING ALL TRAFFIC TO AZURE PRIMARY ($TARGET_IP)..."
echo "========================================================"

# Health check check before switching
echo "🔍 Checking Azure health endpoint..."
if curl -s -f --connect-timeout 4 --max-time 6 "http://${TARGET_IP}:3000/v1/health" | grep -q '"status":"ok"'; then
  echo "✅ Azure is UP and responding with status: ok!"
else
  echo "⚠️ WARNING: Azure health check at http://${TARGET_IP}:3000/v1/health did not return status: ok!"
  read -p "Are you sure you want to proceed with failback to Azure? (y/N): " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

update_record() {
  local record_id="$1"
  local name="$2"

  if [ -z "$record_id" ] || [ "$record_id" == "NOT FOUND" ]; then
    echo "⚠️ Skipping $name (Record ID not found in config)"
    return
  fi

  echo "Updating $name -> $TARGET_IP (Proxied ON)..."
  local res
  res=$(curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${record_id}" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"content\":\"${TARGET_IP}\",\"proxied\":true}")

  local success
  success=$(echo "$res" | jq -r '.success // false')
  if [ "$success" == "true" ]; then
    echo "  ✅ $name updated successfully."
  else
    echo "  ❌ Failed to update $name: $(echo "$res" | jq -r '.errors[0].message // "Unknown error"')"
  fi
}

update_record "${RECORD_ID_ROOT:-}" "speakwithmaya.com"
update_record "${RECORD_ID_WWW:-}" "www.speakwithmaya.com"
update_record "${RECORD_ID_APP:-}" "app.speakwithmaya.com"
update_record "${RECORD_ID_API:-}" "api.speakwithmaya.com"
update_record "${RECORD_ID_ADMIN:-}" "admin.speakwithmaya.com"

echo "========================================================"
echo "🎉 Traffic successfully restored to Azure Primary ($TARGET_IP)!"
echo "Cloudflare edge nodes will cut over within 5–10 seconds."
echo "========================================================"

