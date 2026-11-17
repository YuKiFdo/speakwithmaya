# Maya AI - OVHcloud Backup Server & Cloudflare Failover Setup

This guide provides step-by-step instructions for bringing up the **OVHcloud Backup Server (`139.99.192.179`)** and configuring automated zero-cost Cloudflare failover.

---

## 1. Quick Setup on OVH Server (`139.99.192.179`)

SSH into your OVH server as `root` (or sudo user):
```bash
ssh root@139.99.192.179
```

### Step 1: Clone / Copy Setup Scripts
Create the failover folder and copy the scripts from this repo (`infra/failover/`):
```bash
mkdir -p /home/speakwithmaya/failover-watchdog
```

### Step 2: Run Provisioning Script
Run the automated system bootstrap script:
```bash
sudo bash setup-ovh-server.sh
```
This automatically installs:
- Node.js 22 LTS & PM2
- `espeak-ng` (required for Piper TTS phonemization in NestJS backend)
- Nginx & jq
- Configures user `speakwithmaya` and application directories

### Step 3: Configure Nginx Reverse Proxy
```bash
sudo cp nginx-speakwithmaya.conf /etc/nginx/sites-available/speakwithmaya
sudo ln -sf /etc/nginx/sites-available/speakwithmaya /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

### Step 4: Copy Backend Environment Variables (`.env`)
Copy your existing production `.env` from your Azure VM to the OVH server at:
```bash
/home/speakwithmaya/apps/maya-backend/.env
```
Ensure permissions:
```bash
sudo chown speakwithmaya:speakwithmaya /home/speakwithmaya/apps/maya-backend/.env
sudo chmod 600 /home/speakwithmaya/apps/maya-backend/.env
```

---

## 2. Setting Up Cloudflare Automated Failover

### Step 1: Create a Cloudflare API Token
1. Go to **Cloudflare Dashboard** -> **My Profile** -> **API Tokens** -> **Create Token**.
2. Select **Edit zone DNS** template.
3. Under *Zone Resources*, select:
   - Include -> Specific zone -> `speakwithmaya.com`
4. Click **Continue to summary** and **Create Token**. Copy the token.

### Step 2: Run Auto-Discovery on OVH Server
On the OVH server:
```bash
cd /home/speakwithmaya/failover-watchdog
bash fetch-cf-record-ids.sh YOUR_CLOUDFLARE_API_TOKEN
```
This automatically finds your Zone ID and DNS Record IDs for `speakwithmaya.com`, `app`, and `api`, saving them into `watchdog.env`.

### Step 3: Install & Start the Watchdog Service
```bash
sudo cp maya-watchdog.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now maya-watchdog
```
Check watchdog logs:
```bash
tail -f /home/speakwithmaya/failover-watchdog/watchdog.log
```

---

## 3. Manual Failover / Failback Commands

You can manually switch traffic at any time with 1 command:
- **Route traffic to OVH Backup:**
  ```bash
  bash /home/speakwithmaya/failover-watchdog/switch-to-ovh.sh
  ```
- **Restore traffic to Azure Primary:**
  ```bash
  bash /home/speakwithmaya/failover-watchdog/switch-to-azure.sh
  ```

---

## 4. GitHub Actions Dual Deployment

Add the following secrets to your GitHub repository (**Settings -> Secrets and variables -> Actions**):
- `BACKUP_VM_IP`: `139.99.192.179`
- `BACKUP_VM_USER`: `speakwithmaya`
- `BACKUP_VM_SSH_KEY`: *(Optional if using SSH key, or paste your public key in `/home/speakwithmaya/.ssh/authorized_keys`)*
- `BACKUP_VM_PASSWORD`: *(If using password authentication instead of SSH key)*

Every `git push` to `production` will now automatically build and deploy identical updates to **both Azure and OVH in parallel**.

