'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const WS_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  reconnecting: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false, reconnecting: false });

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      setConnected(false);
      setReconnecting(false);
      return;
    }

    const s = io(WS_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
    });

    s.on('connect', () => {
      setConnected(true);
      setReconnecting(false);
      setReconnectAttempt(0);
    });
    s.on('disconnect', () => setConnected(false));
    s.on('reconnect_attempt', (attempt: number) => {
      setReconnecting(true);
      setReconnectAttempt(attempt);
    });
    s.on('reconnect', () => {
      setReconnecting(false);
      setReconnectAttempt(0);
    });
    s.on('connect_error', (err: Error) => {
      console.warn('[WS]:', err.message);
      setConnected(false);
    });

    const handleOnline = () => {
      if (!s.connected) s.connect();
    };
    window.addEventListener('online', handleOnline);

    setSocket(s);

    return () => {
      window.removeEventListener('online', handleOnline);
      s.disconnect();
      setSocket(null);
      setConnected(false);
      setReconnecting(false);
    };
  }, [token]);

  const showBanner = !!token && !connected;

  return (
    <SocketContext.Provider value={{ socket, connected, reconnecting }}>
      {children}
      {showBanner && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 text-white text-xs px-4 py-2 rounded-full shadow-lg border border-slate-700 pointer-events-none select-none">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          {reconnecting
            ? `Reconnecting… (attempt ${reconnectAttempt})`
            : 'Disconnected — trying to reconnect'}
        </div>
      )}
    </SocketContext.Provider>
  );
}
