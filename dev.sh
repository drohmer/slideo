#!/bin/bash
# Lance le serveur et le client en mode dev

trap 'kill 0' EXIT

echo "[server] Démarrage..."
(cd server && npm run dev) &

echo "[client] Démarrage..."
(cd client && npm run dev) &

wait
