import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { ClientChatEvent, Message, ServerChatEvent } from '../shared/chat';
import { broadcastAdminEvent } from './admin';
import { appendMessage, getChatHistory, removeParticipant, upsertParticipant } from './state';

const clientMeta = new WeakMap<WebSocket, { senderId: string; senderName: string }>();
const typingUsers = new Map<string, string>();
const assignedNames = new Map<string, string>();
let nextPersonNumber = 1;

export const chatWss = new WebSocketServer({ noServer: true });

let chatEnabledEvent: ServerChatEvent = {
  type: 'chat-enabled',
  enabled: false,
}

export function setChatEnabledEvent(event: ServerChatEvent) {
  chatEnabledEvent = event;
  broadcastPayload(event);
}

function logEvent(event: string, details: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      ...details,
    }),
  );
}

function broadcastChat(event: ServerChatEvent) {
  return broadcastPayload(event);
}

export function broadcastPayload(event: any) {
  const encoded = JSON.stringify(event);

  for (const client of chatWss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(encoded);
    }
  }
}

function getAssignedName(senderId: string) {
  const existing = assignedNames.get(senderId);
  if (existing) {
    return existing;
  }

  const name = `Person${nextPersonNumber}`;
  nextPersonNumber += 1;
  assignedNames.set(senderId, name);
  return name;
}

export function sendSystemMessage(content: string, senderName = 'Admin Broadcast') {
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    return;
  }

  const message: Message = {
    id: randomUUID(),
    senderId: 'admin-broadcast',
    senderName,
    content: trimmedContent,
    sentAt: new Date().toISOString(),
  };

  appendMessage(message);

  logEvent('admin-message', {
    senderId: message.senderId,
    senderName: message.senderName,
    content: message.content,
  });

  broadcastChat({
    type: 'message',
    message,
  });

  broadcastAdminEvent({
    type: 'message',
    message,
  });
}

function updateParticipant(
  senderId: string,
  senderName: string,
  updates: Parameters<typeof upsertParticipant>[2],
) {
  const participant = upsertParticipant(senderId, senderName, updates);
  broadcastAdminEvent({
    type: 'participant-state',
    participant,
  });
  return participant;
}

function setTypingState(senderId: string, senderName: string, isTyping: boolean) {
  if (isTyping) {
    typingUsers.set(senderId, senderName);
  } else {
    typingUsers.delete(senderId);
  }

  updateParticipant(senderId, senderName, { isTyping });

  broadcastChat({
    type: 'typing',
    senderId,
    senderName,
    isTyping,
  });
}

export function handleChatUpgrade(request: IncomingMessage, socket: any, head: Buffer) {
  chatWss.handleUpgrade(request, socket, head, (ws) => {
    chatWss.emit('connection', ws, request);
  });
}

chatWss.on('connection', (socket) => {
  logEvent('connection-opened', {
    activeConnections: chatWss.clients.size,
  });

  const historyEvent: ServerChatEvent = {
    type: 'history',
    messages: getChatHistory(),
  };

  socket.send(JSON.stringify(historyEvent));
  socket.send(JSON.stringify(chatEnabledEvent));

  socket.on('message', (raw) => {
    let payload: ClientChatEvent;

    try {
      payload = JSON.parse(raw.toString()) as ClientChatEvent;
    } catch {
      return;
    }

    const senderName = getAssignedName(payload.senderId);

    if ('senderId' in payload && payload.senderId) {
      clientMeta.set(socket, {
        senderId: payload.senderId,
        senderName,
      });
      updateParticipant(payload.senderId, senderName, {});
    }

    if (payload.type === 'keypress') {
      logEvent('keypress', {
        senderId: payload.senderId,
        senderName,
        key: payload.key,
        code: payload.code,
        altKey: payload.altKey,
        ctrlKey: payload.ctrlKey,
        metaKey: payload.metaKey,
        shiftKey: payload.shiftKey,
        cursorStart: payload.cursorStart,
        cursorEnd: payload.cursorEnd,
        draft: payload.draft,
      });

      updateParticipant(payload.senderId, senderName, {
        draft: payload.draft,
        cursorStart: payload.cursorStart,
        cursorEnd: payload.cursorEnd,
        lastKeypress: {
          key: payload.key,
          code: payload.code,
          altKey: payload.altKey,
          ctrlKey: payload.ctrlKey,
          metaKey: payload.metaKey,
          shiftKey: payload.shiftKey,
          at: new Date().toISOString(),
        },
      });
      return;
    }

    if (payload.type === 'draft-update') {
      logEvent('draft-update', {
        senderId: payload.senderId,
        senderName,
        draft: payload.draft,
        cursorStart: payload.cursorStart,
        cursorEnd: payload.cursorEnd,
      });

      updateParticipant(payload.senderId, senderName, {
        draft: payload.draft,
        cursorStart: payload.cursorStart,
        cursorEnd: payload.cursorEnd,
      });
      return;
    }

    if (payload.type === 'cursor-move') {
      logEvent('cursor-move', {
        senderId: payload.senderId,
        senderName,
        draft: payload.draft,
        cursorStart: payload.cursorStart,
        cursorEnd: payload.cursorEnd,
      });

      updateParticipant(payload.senderId, senderName, {
        draft: payload.draft,
        cursorStart: payload.cursorStart,
        cursorEnd: payload.cursorEnd,
      });
      return;
    }

    if (payload.type === 'typing') {
      logEvent('typing', {
        senderId: payload.senderId,
        senderName,
        isTyping: payload.isTyping,
      });
      setTypingState(payload.senderId, senderName, payload.isTyping);
      return;
    }

    if (payload.type === 'ready-state') {
      logEvent('ready-state', {
        senderId: payload.senderId,
        senderName,
        isReady: payload.isReady,
      });

      updateParticipant(payload.senderId, senderName, {
        isReady: payload.isReady,
      });
      return;
    }

    if (payload.type !== 'message' || !payload.content.trim()) {
      return;
    }

    typingUsers.delete(payload.senderId);

    updateParticipant(payload.senderId, senderName, {
      draft: '',
      cursorStart: 0,
      cursorEnd: 0,
      isTyping: false,
    });

    const message: Message = {
      id: randomUUID(),
      senderId: payload.senderId,
      senderName,
      content: payload.content.trim(),
      sentAt: new Date().toISOString(),
    };

    appendMessage(message);

    logEvent('message', {
      senderId: payload.senderId,
      senderName,
      content: payload.content.trim(),
    });

    broadcastChat({
      type: 'message',
      message,
    });

    broadcastAdminEvent({
      type: 'message',
      message,
    });

    broadcastChat({
      type: 'typing',
      senderId: payload.senderId,
      senderName,
      isTyping: false,
    });
  });

  socket.on('close', () => {
    const participant = clientMeta.get(socket);
    logEvent('connection-closed', {
      senderId: participant?.senderId ?? null,
      senderName: participant?.senderName ?? null,
      activeConnections: chatWss.clients.size - 1,
    });

    if (!participant) {
      return;
    }

    if (typingUsers.has(participant.senderId)) {
      setTypingState(participant.senderId, participant.senderName, false);
    }

    removeParticipant(participant.senderId);
    broadcastAdminEvent({
      type: 'participant-left',
      senderId: participant.senderId,
    });
  });
});
