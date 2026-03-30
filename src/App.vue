<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ClientChatEvent, Message, ServerChatEvent } from '@shared/chat';

const wsUrl =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:3001`;

const messages = ref<Message[]>([]);
const draft = ref('');
const socket = ref<WebSocket | null>(null);
const isConnected = ref(false);
const reconnectAttempt = ref(0);
const chatBody = ref<HTMLElement | null>(null);
let shouldReconnect = true;

const title = 'Design Sync';
const subtitle = computed(() => (isConnected.value ? 'online' : 'connecting...'));
const today = new Intl.DateTimeFormat('en', {
  month: 'long',
  day: 'numeric',
}).format(new Date());
const currentUserId = crypto.randomUUID();

const timeFormatter = new Intl.DateTimeFormat([], {
  hour: 'numeric',
  minute: '2-digit',
});

function scrollToBottom(smooth = true) {
  nextTick(() => {
    if (!chatBody.value) {
      return;
    }

    chatBody.value.scrollTo({
      top: chatBody.value.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  });
}

function connect() {
  const connection = new WebSocket(wsUrl);
  socket.value = connection;

  connection.addEventListener('open', () => {
    isConnected.value = true;
    reconnectAttempt.value = 0;
  });

  connection.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data) as ServerChatEvent;

    if (payload.type === 'history') {
      messages.value = payload.messages;
      scrollToBottom(false);
      return;
    }

    if (payload.type === 'message') {
      messages.value = [...messages.value, payload.message];
    }
  });

  connection.addEventListener('close', () => {
    isConnected.value = false;
    socket.value = null;

    if (!shouldReconnect) {
      return;
    }

    const delay = Math.min(1000 * 2 ** reconnectAttempt.value, 6000);
    reconnectAttempt.value += 1;
    window.setTimeout(connect, delay);
  });
}

function sendMessage() {
  const content = draft.value.trim();
  if (!content || !socket.value || socket.value.readyState !== WebSocket.OPEN) {
    return;
  }

  const payload: ClientChatEvent = {
    type: 'message',
    senderId: currentUserId,
    content,
    senderName: 'You',
  };

  socket.value.send(JSON.stringify(payload));
  draft.value = '';
}

function formatTime(timestamp: string) {
  return timeFormatter.format(new Date(timestamp));
}

watch(messages, () => {
  scrollToBottom();
});

onMounted(() => {
  connect();
});

onBeforeUnmount(() => {
  shouldReconnect = false;
  socket.value?.close();
});
</script>

<template>
  <main class="shell">
    <section class="phone-frame">
      <header class="chat-header">
        <div class="avatar">DS</div>
        <div class="chat-meta">
          <h1>{{ title }}</h1>
          <p>{{ subtitle }}</p>
        </div>
      </header>

      <div class="chat-body" ref="chatBody">
        <div class="day-pill">{{ today }}</div>

        <article
          v-for="message in messages"
          :key="message.id"
          class="message-row"
          :class="{ mine: message.senderId === currentUserId }"
        >
          <div class="bubble">
            <p class="sender" v-if="message.senderId !== currentUserId">{{ message.senderName }}</p>
            <p class="content">{{ message.content }}</p>
            <span class="meta">{{ formatTime(message.sentAt) }}</span>
          </div>
        </article>
      </div>

      <form class="composer" @submit.prevent="sendMessage">
        <button class="ghost-button" type="button" aria-label="Attach file">+</button>
        <label class="composer-field">
          <input
            v-model="draft"
            type="text"
            name="message"
            placeholder="Write a message"
            autocomplete="off"
          />
        </label>
        <button class="send-button" type="submit" :disabled="!draft.trim() || !isConnected">
          Send
        </button>
      </form>
    </section>
  </main>
</template>
