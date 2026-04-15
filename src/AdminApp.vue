<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ParticipantState, ServerAdminEvent } from '@shared/admin';
import type { Message, ServerChatEvent } from '@shared/chat';
import ParticipantCard from "./ParticipantCard.vue";
import MessageLog from './MessageLog.vue';

const adminWsUrl =
  import.meta.env.VITE_ADMIN_WS_URL ??
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:5061/webchat/backend/ws/admin`;

const chatEnabled = ref(false);
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

onMounted(() => {
  connect();
});

onBeforeUnmount(() => {
  shouldReconnect = false;
  adminSocket.value?.close();
});
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
        <MessageLog :messages="messages" />
      </article>

      <section class="admin-grid">
        <ParticipantCard v-for="participant in orderedParticipants" :key="participant.senderId"
          :showPreparationChips="!chatEnabled"
          :participant="participant"
          :showKeypress="true"
        />
      </section>
    </section>
  </main>
</template>
