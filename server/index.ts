import { createServer } from 'node:http';
import { handleAdminUpgrade } from './admin';
import { handleChatUpgrade } from './chat';

const port = Number(process.env.PORT ?? 3001);
const server = createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(
    JSON.stringify({
      status: 'ok',
      websocket: true,
      endpoints: ['/ws/chat', '/ws/admin'],
      path: request.url ?? '/',
    }),
  );
});

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (url.pathname === '/ws/chat') {
    handleChatUpgrade(request, socket, head);
    return;
  }

  if (url.pathname === '/ws/admin') {
    handleAdminUpgrade(request, socket, head);
    return;
  }

  socket.destroy();
});

server.listen(port, () => {
  console.log(`WebSocket chat server listening on http://localhost:${port}`);
});
