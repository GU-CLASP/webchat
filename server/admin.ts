import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { ClientAdminEvent, ServerAdminEvent } from '../shared/admin';
import { getChatHistory, getParticipants } from './state';
import { sendSystemMessage } from './chat';

export const adminWss = new WebSocketServer({ noServer: true });

function send(socket: WebSocket, event: ServerAdminEvent) {
  socket.send(JSON.stringify(event));
}

export function handleAdminUpgrade(request: IncomingMessage, socket: any, head: Buffer) {
  adminWss.handleUpgrade(request, socket, head, (ws) => {
    adminWss.emit('connection', ws, request);
  });
}

export function broadcastAdminEvent(event: ServerAdminEvent) {
  const encoded = JSON.stringify(event);

  for (const client of adminWss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(encoded);
    }
  }
}

adminWss.on('connection', (socket) => {
  send(socket, {
    type: 'snapshot',
    participants: getParticipants(),
    messages: getChatHistory(),
  });

  socket.on('message', (raw) => {
    let payload: ClientAdminEvent;

    try {
      payload = JSON.parse(raw.toString()) as ClientAdminEvent;
    } catch {
      return;
    }

    if (payload.type !== 'broadcast-message') {
      return;
    }

    sendSystemMessage(payload.content);
  });
});
