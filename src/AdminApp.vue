<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ParticipantState, ServerAdminEvent } from '@shared/admin';
import type { Message, ServerChatEvent } from '@shared/chat';

const adminWsUrl =
  import.meta.env.VITE_ADMIN_WS_URL ??
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:5061/webchat/backend/ws/admin`;

const participants = ref<Record<string, ParticipantState>>({});
const messages = ref<Message[]>([]);
const isConnected = ref(false);
const draft = ref('');
const reconnectAttempt = ref(0);
const adminSocket = ref<WebSocket | null>(null);
let shouldReconnect = true;

const orderedParticipants = computed(() =>
  Object.values(participants.value).sort((left, right) =>
    right.lastSeenAt.localeCompare(left.lastSeenAt),
  ),
);

const readyCount = computed(() =>
  Object.values(participants.value).filter((participant) => participant.isReady).length,
);

function connect() {
  const socket = new WebSocket(adminWsUrl);
  adminSocket.value = socket;

  socket.addEventListener('open', () => {
    isConnected.value = true;
    reconnectAttempt.value = 0;
  });

  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data) as ServerAdminEvent;

    if (payload.type === 'snapshot') {
      participants.value = Object.fromEntries(
        payload.participants.map((participant) => [participant.senderId, participant]),
      );
      messages.value = payload.messages;
      return;
    }

    if (payload.type === 'participant-state') {
      participants.value = {
        ...participants.value,
        [payload.participant.senderId]: payload.participant,
      };
      return;
    }

    if (payload.type === 'message') {
      messages.value = [...messages.value, payload.message];
      return;
    }

    if (payload.type === 'participant-left') {
      const next = { ...participants.value };
      delete next[payload.senderId];
      participants.value = next;
    }
  });

  socket.addEventListener('close', () => {
    isConnected.value = false;
    if (adminSocket.value === socket) {
      adminSocket.value = null;
    }

    if (!shouldReconnect) {
      return;
    }

    const delay = Math.min(1000 * 2 ** reconnectAttempt.value, 6000);
    reconnectAttempt.value += 1;
    window.setTimeout(connect, delay);
  });
}

function sendBroadcast() {
  const content = draft.value.trim();

  if (!content || !adminSocket.value || adminSocket.value.readyState !== WebSocket.OPEN) {
    return;
  }

  const payload: ServerChatEvent = {
    type: 'broadcast-message',
    content,
  };

  adminSocket.value.send(JSON.stringify(payload));
  draft.value = '';
}

function enableDisableChat() {
  if (!adminSocket.value || adminSocket.value.readyState !== WebSocket.OPEN) {
    return;
  }

  const payload: ServerChatEvent = {
    type: 'chat-enabled',
    enabled: chatEnabled.value,
  };
  adminSocket.value.send(JSON.stringify(payload));
}

function formatCursor(participant: ParticipantState) {
  if (participant.cursorStart === null && participant.cursorEnd === null) {
    return 'No selection';
  }

  if (participant.cursorStart === participant.cursorEnd) {
    return `Cursor at ${participant.cursorStart}`;
  }

  return `Selection ${participant.cursorStart}-${participant.cursorEnd}`;
}

function renderDraftWithCursor(participant: ParticipantState) {
  const start = participant.cursorStart ?? participant.draft.length;
  const end = participant.cursorEnd ?? start;
  const cursorStart = Math.min(start, end);
  const cursorEnd = Math.max(start, end);
  const before = participant.draft.slice(0, cursorStart);
  const middle = participant.draft.slice(cursorStart, cursorEnd);
  const after = participant.draft.slice(cursorEnd);

  if (cursorStart === cursorEnd) {
    return `${before}|${after}`;
  }

  return `${before}[${middle}]${after}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

onMounted(() => {
  connect();
});

onBeforeUnmount(() => {
  shouldReconnect = false;
  adminSocket.value?.close();
});

const chatEnabled = ref(true);
</script>

<template>
  <main class="admin-shell">
    <header class="admin-header">
      <div>
        <p class="eyebrow">Research Console</p>
        <h1>Live Client Monitor</h1>
      </div>
      <p class="status" :class="{ live: isConnected }">
        {{ isConnected ? 'Admin feed connected' : 'Reconnecting admin feed...' }}
      </p>
    </header>

    <section class="admin-layout">
      <article class="message-panel">
        <div class="message-panel-head">
          <h2>Shared Chat View</h2>
          <p>{{ messages.length }} messages mirrored from the main chat</p>
        </div>

        <p class="ready-summary">
          {{ readyCount }} of {{ orderedParticipants.length }} users marked ready
        </p>

        <input type="checkbox" @change="enableDisableChat" v-model="chatEnabled" />Enable chat
        <form class="broadcast-form" @submit.prevent="sendBroadcast">
          <label class="label" for="broadcast-message">Broadcast message</label>
          <textarea
            id="broadcast-message"
            v-model="draft"
            class="broadcast-input"
            rows="3"
            placeholder="Send a message to everyone in chat"
          />
          <button class="broadcast-button" type="submit" :disabled="!draft.trim() || !isConnected">
            Send to all users
          </button>
        </form>

        <div class="message-feed">
          <article v-for="message in messages" :key="message.id" class="message-card">
            <div class="message-card-head">
              <strong>{{ message.senderName }}</strong>
              <span>{{ formatTime(message.sentAt) }}</span>
            </div>
            <p>{{ message.content }}</p>
          </article>
        </div>
      </article>

      <section class="admin-grid">
      <article v-for="participant in orderedParticipants" :key="participant.senderId" class="admin-card">
        <div class="admin-card-head">
          <div>
            <h2>{{ participant.senderName }}</h2>
            <p class="participant-id">{{ participant.senderId }}</p>
          </div>
          <div class="participant-chips">
            <span class="ready-chip" :class="{ active: participant.isReady }">
              {{ participant.isReady ? 'Ready' : 'Not ready' }}
            </span>
            <span class="typing-chip" :class="{ active: participant.isTyping }">
              {{ participant.isTyping ? 'Typing' : 'Idle' }}
            </span>
          </div>
        </div>

        <div class="field">
          <span class="label">Draft</span>
          <pre class="draft-preview">{{ renderDraftWithCursor(participant) }}</pre>
        </div>

        <div class="field">
          <span class="label">Cursor</span>
          <p>{{ formatCursor(participant) }}</p>
        </div>

        <div class="field">
          <span class="label">Last Keypress</span>
          <p v-if="participant.lastKeypress">
            {{ participant.lastKeypress.key }} ({{ participant.lastKeypress.code }}) at
            {{ formatTime(participant.lastKeypress.at) }}
          </p>
          <p v-else>No keypress captured yet</p>
        </div>

        <div class="field meta-grid">
          <div>
            <span class="label">Connected</span>
            <p>{{ formatTime(participant.connectedAt) }}</p>
          </div>
          <div>
            <span class="label">Last Seen</span>
            <p>{{ formatTime(participant.lastSeenAt) }}</p>
          </div>
        </div>
      </article>
      </section>
    </section>
  </main>
</template>
