import { createServer } from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { parse } from 'url';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir: '.' });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(server, {
    path: '/socket.io',
    cors: {
      origin: process.env.APP_URL || 'http://localhost:3000',
      credentials: true
    }
  });

  globalThis.__io = io;

  io.on('connection', (socket) => {
    socket.on('join-thread', (threadId) => {
      socket.join(`thread:${threadId}`);
    });

    socket.on('typing', (payload) => {
      const { threadId, name, userId, isTyping } = payload || {};
      if (!threadId) return;
      socket.to(`thread:${threadId}`).emit('typing', { threadId, name, userId, isTyping: !!isTyping });
    });
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`HOSTEA web running on http://localhost:${port}`);
  });
});
