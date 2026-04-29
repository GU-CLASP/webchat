import type { Duplex } from 'node:stream';
import { createServer } from 'node:http';
import { handleAdminUpgrade } from './admin';
import { handleChatUpgrade } from './chat';

const port = Number(process.env.PORT ?? 5061);
const server = createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(
    JSON.stringify({
      status: 'ok',
      websocket: true,
      endpoints: ['/webchat/backend/ws/chat', '/webchat/backend/ws/admin'],
      path: request.url ?? '/',
    }),
  );
});

function rejectUpgrade(socket: Duplex, statusCode: number, statusText: string) {
  const body = `${statusText}\n`;

  socket.end([
    `HTTP/1.1 ${statusCode} ${statusText}`,
    'Connection: close',
    'Content-Type: text/plain; charset=utf-8',
    `Content-Length: ${Buffer.byteLength(body)}`,
    '',
    body,
  ].join('\r\n'));
}

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (url.pathname === '/webchat/backend/ws/chat') {
    handleChatUpgrade(request, socket, head);
    return;
  }

  if (url.pathname === '/webchat/backend/ws/admin') {
    if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD !== url.searchParams.get('password')) {
      console.log("Admin entered wrong password and was rejected.");
      rejectUpgrade(socket, 401, 'Unauthorized');
      return;
    }
    console.log("Admin connected.");
    handleAdminUpgrade(request, socket, head);
    return;
  }

  socket.destroy();
});

server.listen(port, () => {
  console.log(`WebSocket chat server listening on http://localhost:${port}`);
});
