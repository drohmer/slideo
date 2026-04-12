#!/bin/bash
set -e

SERVER="damien-scaleway"
REMOTE_DIR="/opt/slideo"

echo "==> Syncing project to $SERVER:$REMOTE_DIR..."
rsync -avz --delete \
  --exclude node_modules --exclude .git \
  --exclude server/data --exclude server/uploads \
  ./ "$SERVER:$REMOTE_DIR/"

echo "==> Installing dependencies and building on $SERVER..."
ssh "$SERVER" bash -s <<'EOF'
set -e
cd /opt/slideo

echo "  -> Installing client deps..."
cd client && npm install && npm run build && cd ..

echo "  -> Installing server deps..."
cd server && npm install && npm run build && cd ..

echo "  -> Setting up systemd service..."
cat > /tmp/slideo.service <<'UNIT'
[Unit]
Description=Slideo presentation server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/slideo/server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001
EnvironmentFile=/opt/slideo/server/.env

[Install]
WantedBy=multi-user.target
UNIT

sudo mv /tmp/slideo.service /etc/systemd/system/slideo.service
sudo systemctl daemon-reload
sudo systemctl enable slideo
sudo systemctl restart slideo

echo "  -> Checking status..."
sleep 1
sudo systemctl status slideo --no-pager -l
EOF

echo "==> Done! Slideo is running on http://$SERVER:3001"
