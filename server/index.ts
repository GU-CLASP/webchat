import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import type { ClientChatEvent, Message, ServerChatEvent } from '../shared/chat';

const port = Number(process.env.PORT ?? 3001);
const server = createServer((_, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ status: 'ok', websocket: true }));
});

const wss = new WebSocketServer({ server });
const history: Message[] = [
  {
    id: randomUUID(),
    senderId: 'alex',
    senderName: 'Alex',
    content: 'Morning! This room is wired up over WebSockets now.',
    sentAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
  },
  {
    id: randomUUID(),
    senderId: 'me',
    senderName: 'You',
    content: 'Perfect. The UI already feels pretty close to Telegram.',
    sentAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
];

function broadcast(event: ServerChatEvent) {
  const encoded = JSON.stringify(event);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(encoded);
    }
  }
}

wss.on('connection', (socket) => {
  const historyEvent: ServerChatEvent = {
    type: 'history',
    messages: history,
  };

  socket.send(JSON.stringify(historyEvent));

  socket.on('message', (raw) => {
    let payload: ClientChatEvent;

    try {
      payload = JSON.parse(raw.toString()) as ClientChatEvent;
    } catch {
      return;
    }

    if (payload.type !== 'message' || !payload.content.trim()) {
      return;
    }

    const message: Message = {
      id: randomUUID(),
      senderId: payload.senderId,
      senderName: payload.senderName || 'You',
      content: payload.content.trim(),
      sentAt: new Date().toISOString(),
    };

    history.push(message);
    if (history.length > 100) {
      history.shift();
    }

    broadcast({
      type: 'message',
      message,
    });
  });
});

server.listen(port, () => {
  console.log(`WebSocket chat server listening on http://localhost:${port}`);
});
