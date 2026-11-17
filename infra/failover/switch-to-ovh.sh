#!/usr/bin/env bash
# ==============================================================================
# Maya AI - 1-Click Failover to OVHcloud Backup Server (139.99.192.179)
# Usage:
#   bash switch-to-ovh.sh
# ==============================================================================

set -euo pipefail

ENV_FILE="$(dirname "$0")/watchdog.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Configuration file $ENV_FILE not found. Run fetch-cf-record-ids.sh first."
  exit 1
fi

source "$ENV_FILE"

TARGET_IP="${BACKUP_IP:-139.99.192.179}"

echo "========================================================"
echo "🚨 ROUTING ALL TRAFFIC TO OVHCLOUD BACKUP ($TARGET_IP)..."
echo "========================================================"

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
echo "🎉 Traffic successfully steered to OVHcloud Backup ($TARGET_IP)!"
echo "Cloudflare edge nodes will cut over within 5–10 seconds."
echo "========================================================"

