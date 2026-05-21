import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyToken } from './authService';

let io: Server | null = null;

export const initWs = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: { origin: '*', credentials: true }
  });

  // JWT authentication middleware — runs before 'connection' fires
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.data.user = verifyToken(token);
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', socket => {
    const { email, role } = socket.data.user ?? {};
    console.log(`[WS] Connected: ${socket.id} (${email}, ${role})`);
    socket.on('disconnect', () => {
      console.log(`[WS] Disconnected: ${socket.id} (${email})`);
    });
  });

  return io;
};

export const emit = (event: string, data: unknown): void => {
  io?.emit(event, data);
};
