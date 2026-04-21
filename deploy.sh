#!/bin/bash
# Generic deploy script for Slideo.
# Copy this file to deploy.local.sh, set the variables, and run that instead.
# deploy.local.sh is gitignored and stays local.
set -e

# ── Configuration ──────────────────────────────────────────────────────────────
SERVER="${SLIDEO_SERVER:-your-server-hostname}"   # SSH host alias or user@host
REMOTE_DIR="${SLIDEO_DIR:-/opt/slideo}"           # Absolute path on the remote
SERVICE="${SLIDEO_SERVICE:-slideo}"               # systemd service name
PORT="${SLIDEO_PORT:-3001}"
# ────────────────────────────────────────────────────────────────────────────────

if [ "$SERVER" = "your-server-hostname" ]; then
  echo "ERROR: No server configured."
  echo "  Copy deploy.sh to deploy.local.sh and set SLIDEO_SERVER (or edit the defaults)."
  exit 1
fi

echo "==> Syncing project to $SERVER:$REMOTE_DIR..."
rsync -avz --delete \
  --exclude node_modules --exclude .git \
  --exclude server/data --exclude server/uploads \
  ./ "$SERVER:$REMOTE_DIR/"

echo "==> Installing dependencies and building on $SERVER..."
ssh "$SERVER" bash -s <<EOF
set -e
cd "$REMOTE_DIR"

echo "  -> Installing client deps..."
cd client && npm install && npm run build && cd ..

echo "  -> Installing server deps..."
cd server && npm install && npm run build && cd ..

echo "  -> Setting up systemd service..."
cat > /tmp/${SERVICE}.service <<UNIT
[Unit]
Description=Slideo presentation server
After=network.target

[Service]
Type=simple
WorkingDirectory=$REMOTE_DIR/server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=$PORT
EnvironmentFile=$REMOTE_DIR/server/.env

[Install]
WantedBy=multi-user.target
UNIT

sudo mv /tmp/${SERVICE}.service /etc/systemd/system/${SERVICE}.service
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE"
sudo systemctl restart "$SERVICE"

echo "  -> Checking status..."
sleep 1
sudo systemctl status "$SERVICE" --no-pager -l
EOF

echo "==> Done! Slideo is running on http://$SERVER:$PORT"
