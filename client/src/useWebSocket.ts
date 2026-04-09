import { useEffect, useRef, useState, useCallback } from 'react';
import type { WsMessage } from './types';

export function useWebSocket(
  presentationId: string | undefined,
  onMessage: (msg: WsMessage) => void,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const retryDelay = useRef(1000);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const mountedRef = useRef(true);

  // Throttle refs (declared before useEffect so cleanup can access them)
  const lastSentRef = useRef(0);
  const pendingRef = useRef<WsMessage | null>(null);
  const throttleTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    mountedRef.current = true;
    if (!presentationId) return;

    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      if (!mountedRef.current) return;
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        retryDelay.current = 1000;
        ws.send(JSON.stringify({ type: 'join', presentationId }));
      };

      ws.onmessage = (e) => {
        try {
          const msg: WsMessage = JSON.parse(e.data);
          onMessageRef.current(msg);
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        if (mountedRef.current) {
          reconnectTimer = setTimeout(() => {
            retryDelay.current = Math.min(retryDelay.current * 2, 30000);
            connect();
          }, retryDelay.current);
        }
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer);
      clearTimeout(throttleTimer.current);
      // Flush pending throttled message before closing
      if (pendingRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(pendingRef.current));
        pendingRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [presentationId]);

  const sendMessage = useCallback((msg: WsMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(msg));
  }, []);

  const sendThrottled = useCallback((msg: WsMessage) => {
    pendingRef.current = msg;
    const now = Date.now();
    if (now - lastSentRef.current >= 50) {
      lastSentRef.current = now;
      sendMessage(msg);
      pendingRef.current = null;
    } else {
      clearTimeout(throttleTimer.current);
      throttleTimer.current = setTimeout(() => {
        if (pendingRef.current) {
          sendMessage(pendingRef.current);
          pendingRef.current = null;
          lastSentRef.current = Date.now();
        }
      }, 50);
    }
  }, [sendMessage]);

  return { sendMessage, sendThrottled, isConnected };
}
