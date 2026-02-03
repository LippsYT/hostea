import type { Server as SocketIOServer } from 'socket.io';

declare global {
  // eslint-disable-next-line no-var
  var __io: SocketIOServer | undefined;
}

export const getIO = () => {
  if (!globalThis.__io) {
    throw new Error('Socket.IO server not initialized');
  }
  return globalThis.__io;
};
