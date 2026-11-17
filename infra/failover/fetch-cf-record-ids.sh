#!/usr/bin/env bash
# ==============================================================================
# Maya AI - Cloudflare DNS Records Auto-Discovery Helper
# Usage:
#   bash fetch-cf-record-ids.sh <YOUR_CLOUDFLARE_API_TOKEN>
# ==============================================================================

set -euo pipefail

CF_API_TOKEN="${1:-${CF_API_TOKEN:-}}"

if [ -z "$CF_API_TOKEN" ]; then
  echo "Usage: bash fetch-cf-record-ids.sh <CLOUDFLARE_API_TOKEN>"
  echo "Example: bash fetch-cf-record-ids.sh abc123def456..."
  exit 1
fi

DOMAIN="speakwithmaya.com"
OUTPUT_FILE="$(dirname "$0")/watchdog.env"

echo "🔍 Fetching Zone ID for $DOMAIN..."
ZONE_RESP=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json")

ZONE_ID=$(echo "$ZONE_RESP" | jq -r '.result[0].id // empty')

if [ -z "$ZONE_ID" ] || [ "$ZONE_ID" == "null" ]; then
  echo "❌ Error: Could not find Zone ID for $DOMAIN. Please check your API Token permissions (Zone.DNS Edit)."
  echo "API Response: $ZONE_RESP"
  exit 1
fi

echo "✅ Zone ID found: $ZONE_ID"

echo "🔍 Fetching DNS Record IDs for $DOMAIN and subdomains..."
RECORDS_RESP=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?type=A" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json")

ROOT_ID=$(echo "$RECORDS_RESP" | jq -r '.result[] | select(.name=="speakwithmaya.com") | .id' | head -n1)
WWW_ID=$(echo "$RECORDS_RESP" | jq -r '.result[] | select(.name=="www.speakwithmaya.com") | .id' | head -n1)
APP_ID=$(echo "$RECORDS_RESP" | jq -r '.result[] | select(.name=="app.speakwithmaya.com") | .id' | head -n1)
API_ID=$(echo "$RECORDS_RESP" | jq -r '.result[] | select(.name=="api.speakwithmaya.com") | .id' | head -n1)
ADMIN_ID=$(echo "$RECORDS_RESP" | jq -r '.result[] | select(.name=="admin.speakwithmaya.com") | .id' | head -n1)

echo "--------------------------------------------------------"
echo "Root Record (speakwithmaya.com):     ${ROOT_ID:-NOT FOUND}"
echo "WWW Record (www.speakwithmaya.com):  ${WWW_ID:-NOT FOUND}"
echo "App Record (app.speakwithmaya.com):  ${APP_ID:-NOT FOUND}"
echo "API Record (api.speakwithmaya.com):  ${API_ID:-NOT FOUND}"
echo "Admin Record (admin.speakwithmaya.com): ${ADMIN_ID:-NOT FOUND}"
echo "--------------------------------------------------------"

cat <<EOF > "$OUTPUT_FILE"
# Maya AI Cloudflare Failover Watchdog Configuration
CF_API_TOKEN="${CF_API_TOKEN}"
CF_ZONE_ID="${ZONE_ID}"

RECORD_ID_ROOT="${ROOT_ID}"
RECORD_ID_WWW="${WWW_ID}"
RECORD_ID_APP="${APP_ID}"
RECORD_ID_API="${API_ID}"
RECORD_ID_ADMIN="${ADMIN_ID}"

PRIMARY_IP="20.198.240.185"
BACKUP_IP="139.99.192.179"
PRIMARY_HEALTH_URL="http://20.198.240.185:3000/v1/health"

# Failover threshold: 3 consecutive failed health probes (15s interval = 45s detection)
FAIL_THRESHOLD=3
EOF

echo "✅ Configuration saved to $OUTPUT_FILE!"

