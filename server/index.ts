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
const clientMeta = new WeakMap<WebSocket, { senderId: string; senderName: string }>();
const typingUsers = new Map<string, string>();
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

function setTypingState(senderId: string, senderName: string, isTyping: boolean) {
  if (isTyping) {
    typingUsers.set(senderId, senderName);
  } else {
    typingUsers.delete(senderId);
  }

  broadcast({
    type: 'typing',
    senderId,
    senderName,
    isTyping,
  });
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

    if ('senderId' in payload && payload.senderId) {
      clientMeta.set(socket, {
        senderId: payload.senderId,
        senderName: payload.senderName || 'You',
      });
    }

    if (payload.type === 'typing') {
      setTypingState(payload.senderId, payload.senderName || 'You', payload.isTyping);
      return;
    }

    if (payload.type !== 'message' || !payload.content.trim()) {
      return;
    }

    typingUsers.delete(payload.senderId);

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

    broadcast({
      type: 'typing',
      senderId: payload.senderId,
      senderName: payload.senderName || 'You',
      isTyping: false,
    });
  });

  socket.on('close', () => {
    const participant = clientMeta.get(socket);
    if (!participant) {
      return;
    }

    if (typingUsers.has(participant.senderId)) {
      setTypingState(participant.senderId, participant.senderName, false);
    }
  });
});

server.listen(port, () => {
  console.log(`WebSocket chat server listening on http://localhost:${port}`);
});
