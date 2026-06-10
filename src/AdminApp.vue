<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { formatTime } from '@shared/admin';
import type { AdminNotification, ParticipantState, ServerAdminEvent } from '@shared/admin';
import type { Message, ServerChatEvent } from '@shared/chat';
import ParticipantCard from "./ParticipantCard.vue";
import MessageLog from './MessageLog.vue';

const adminWsUrl =
  import.meta.env.VITE_ADMIN_WS_URL ??
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:5061/webchat/backend/ws/admin`;

const chatEnabled = ref(false);
const participants = ref<Record<string, ParticipantState>>({});
const messages = ref<Message[]>([]);
const notifications = ref<AdminNotification[]>([]);
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

const recentNotifications = computed(() => notifications.value.slice(0, 10));

function notificationText(notification: AdminNotification) {
  if (notification.kind === 'app-open') {
    return `${notification.senderName} opened the app`;
  }

  return `${notification.senderName} left the app`;
}

function connect() {
  const url = new URL(window.location.href);
  const socket = new WebSocket(adminWsUrl + "?password=" + url.searchParams.get('password'));
  adminSocket.value = socket;

  socket.addEventListener('open', () => {
    console.log("WS Open");
    isConnected.value = true;
    reconnectAttempt.value = 0;
  });

  socket.addEventListener('error', (event) => {
    console.log(event);
  });

  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data) as ServerAdminEvent;

    if (payload.type === 'snapshot') {
      participants.value = Object.fromEntries(
        payload.participants.map((participant) => [participant.senderId, participant]),
      );
      messages.value = payload.messages;
      notifications.value = payload.notifications ?? [];
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

    if (payload.type === 'notification') {
      notifications.value = [payload.notification, ...notifications.value].slice(0, 100);
      return;
    }

    if (payload.type === 'participant-left') {
      const next = { ...participants.value };
      delete next[payload.senderId];
      participants.value = next;
    }
  });

  socket.addEventListener('close', (e) => {
    console.log("WS Close");
    console.log(e);
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

    <section class="send-message">
      <p class="ready-summary">
        {{ readyCount }} of {{ orderedParticipants.length }} users marked ready
        <input type="checkbox" @change="enableDisableChat" v-model="chatEnabled" />Enable chat
      </p>

      <form class="broadcast-form" @submit.prevent="sendBroadcast">
        <input
          type="text"
          id="broadcast-message"
          v-model="draft"
          class="broadcast-input"
          placeholder="Send a message to everyone in chat" />
        <button class="broadcast-button" type="submit" :disabled="!draft.trim() || !isConnected">
          Broadcast
        </button>
      </form>
    </section>

    <section class="notification-panel" aria-live="polite">
      <div class="notification-panel-head">
        <h2>App Activity</h2>
        <p>{{ notifications.length }} lifecycle notifications</p>
      </div>
      <ol class="notification-list" v-if="recentNotifications.length">
        <li
          v-for="notification in recentNotifications"
          :key="notification.id"
          class="notification-item"
          :class="notification.kind"
        >
          <span class="notification-dot" aria-hidden="true"></span>
          <div>
            <p>{{ notificationText(notification) }}</p>
            <time :datetime="notification.createdAt">{{ formatTime(notification.createdAt) }}</time>
          </div>
        </li>
      </ol>
      <p v-else class="empty-notifications">No app activity yet</p>
    </section>

    <section class="admin-layout">
      <article class="message-panel">
        <div class="message-panel-head">
          <h2>Shared Chat View</h2>
          <p>{{ messages.length }} messages mirrored from the main chat</p>
        </div>
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
