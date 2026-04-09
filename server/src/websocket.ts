import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
  roomId: string | null;
}

const rooms = new Map<string, Set<ExtWebSocket>>();

function joinRoom(ws: ExtWebSocket, roomId: string) {
  leaveRoom(ws);
  ws.roomId = roomId;
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId)!.add(ws);
}

function leaveRoom(ws: ExtWebSocket) {
  if (ws.roomId) {
    const room = rooms.get(ws.roomId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) rooms.delete(ws.roomId);
    }
    ws.roomId = null;
  }
}

function broadcast(ws: ExtWebSocket, data: string) {
  if (!ws.roomId) return;
  const room = rooms.get(ws.roomId);
  if (!room) return;
  for (const client of room) {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Heartbeat every 30s
  const interval = setInterval(() => {
    for (const ws of wss.clients as Set<ExtWebSocket>) {
      if (!ws.isAlive) {
        leaveRoom(ws);
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  wss.on('connection', (raw) => {
    const ws = raw as ExtWebSocket;
    ws.isAlive = true;
    ws.roomId = null;

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      let msg: { type: string; presentationId?: string; [key: string]: unknown };
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (msg.type === 'join' && msg.presentationId) {
        joinRoom(ws, msg.presentationId);
        return;
      }

      if (msg.type === 'leave') {
        leaveRoom(ws);
        return;
      }

      // Relay all other messages to the room
      broadcast(ws, data.toString());
    });

    ws.on('close', () => leaveRoom(ws));
  });
}
