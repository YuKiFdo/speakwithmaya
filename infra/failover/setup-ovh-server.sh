#!/usr/bin/env bash
# ==============================================================================
# Maya AI - OVHcloud Server Bootstrap Script (Backup Server 139.99.192.179)
# Run as root or with sudo:
#   sudo bash setup-ovh-server.sh
# ==============================================================================

set -euo pipefail

echo "========================================================"
echo "🚀 Starting Maya AI OVHcloud Backup Server Provisioning"
echo "========================================================"

APP_USER="speakwithmaya"

# 1. Update APT and install essential system tools
echo "📦 [1/6] Installing system packages..."
apt-get update
apt-get install -y curl wget git rsync build-essential espeak-ng nginx jq ufw

# 2. Install Node.js 22 (matching Azure VM) & PM2
echo "📦 [2/6] Installing Node.js 22 LTS and PM2..."
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1)" != "v22" ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

# 3. Create app user & application directory tree
echo "👤 [3/6] Setting up user '$APP_USER' and directories..."
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$APP_USER"
fi

mkdir -p /home/$APP_USER/apps/maya-backend/assets/audio-cache
mkdir -p /home/$APP_USER/apps/maya-frontend/dist
mkdir -p /home/$APP_USER/apps/maya-frontend/web-server
mkdir -p /home/$APP_USER/apps/maya-landing
mkdir -p /home/$APP_USER/failover-watchdog
mkdir -p /home/$APP_USER/.ssh
chmod 700 /home/$APP_USER/.ssh

# Configure PM2 systemd startup
env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER || true

# 4. Configure UFW Firewall (Allow SSH, HTTP, HTTPS)
echo "🛡️  [4/6] Configuring Firewall..."
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw --force enable || true

# 5. Fix permissions
echo "🔒 [5/6] Setting permissions..."
chown -R $APP_USER:$APP_USER /home/$APP_USER

echo "========================================================"
echo "✅ OVH Server provisioning completed!"
echo "Next steps:"
echo " 1. Copy Nginx config: sudo cp nginx-speakwithmaya.conf /etc/nginx/sites-available/speakwithmaya"
echo " 2. Enable site: sudo ln -sf /etc/nginx/sites-available/speakwithmaya /etc/nginx/sites-enabled/"
echo " 3. Test & restart: sudo nginx -t && sudo systemctl restart nginx"
echo " 4. Copy .env file: /home/$APP_USER/apps/maya-backend/.env"
echo "========================================================"

