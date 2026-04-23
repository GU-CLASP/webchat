<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, Ref, ref, watch } from 'vue';
import type { ClientChatEvent, Message, ServerChatEvent } from '@shared/chat';
import { chatWsUrl } from './chat-app';
import ClickExperiment from './ClickExperiment.vue';

const chatEnabled = ref(true);
const messages = ref<Message[]>([]);
const draft = ref('');
const typingUsers = ref<Record<string, string>>({});
const socket = ref<WebSocket | null>(null);
const isConnected = ref(false);
const isReady: Ref<boolean | null, boolean | null> = ref(null);
const reconnectAttempt = ref(0);
const chatBody = ref<HTMLElement | null>(null);
const draftInput = ref<HTMLInputElement | null>(null);
const assignedSenderName = ref<string | null>(null);
const disableSendMessage = computed(() => {
  if (!chatEnabled.value) return true;
  return !draft.value.trim() || !isConnected.value
});

let shouldReconnect = true;
let typingIdleTimer: number | undefined;
let sentTypingState = false;

const CLICK_EXPERIMENT = import.meta.env.VITE_CLICK_EXPERIMENT === 'true';
const title = 'DivCon Chat';
const subtitle = computed(() => {
  if (!isConnected.value) {
    return 'connecting...';
  }

  const names = Object.values(typingUsers.value);
  if (names.length === 0) {
    return 'online';
  }

  if (names.length === 1) {
    return `${names[0]} is typing...`;
  }

  return `${names.length} people are typing...`;
});
const today = new Intl.DateTimeFormat('en', {
  month: 'long',
  day: 'numeric',
}).format(new Date());
const currentUserId = crypto.randomUUID();
const currentUserName = 'You';

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
  console.log(`Connecting to ${chatWsUrl}...`);
  const connection = new WebSocket(chatWsUrl);
  socket.value = connection;

  connection.addEventListener('open', () => {
    console.log(`Connected to chat websocket!`);
    isConnected.value = true;
    reconnectAttempt.value = 0;

    sendClientEvent({
      type: 'ready-state',
      senderId: currentUserId,
      senderName: currentUserName,
      isReady: isReady.value,
    });
  });

  connection.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data) as ServerChatEvent;

    if (payload.type === 'history') {
      messages.value = payload.messages;
      scrollToBottom(false);
      return;
    }
    if (payload.type === 'identity') {
      if (payload.senderId === currentUserId) {
        assignedSenderName.value = payload.senderName;
      }
      return;
    }
    if (payload.type === 'chat-enabled') {
      chatEnabled.value = payload.enabled;
    }

    if (payload.type === 'message') {
      messages.value = [...messages.value, payload.message];
      return;
    }

    if (payload.type === 'typing') {
      if (payload.senderId === currentUserId) {
        return;
      }

      if (payload.isTyping) {
        typingUsers.value = {
          ...typingUsers.value,
          [payload.senderId]: payload.senderName,
        };
        scrollToBottom();
        return;
      }

      const nextUsers = { ...typingUsers.value };
      delete nextUsers[payload.senderId];
      typingUsers.value = nextUsers;
    }
  });

  connection.addEventListener('close', () => {
    isConnected.value = false;
    socket.value = null;
    typingUsers.value = {};
    assignedSenderName.value = null;

    if (!shouldReconnect) {
      return;
    }

    const delay = Math.min(1000 * 2 ** reconnectAttempt.value, 6000);
    reconnectAttempt.value += 1;
    window.setTimeout(connect, delay);
  });
}

function emitTyping(isTyping: boolean) {
  if (!socket.value || socket.value.readyState !== WebSocket.OPEN || sentTypingState === isTyping) {
    return;
  }

  const payload: ClientChatEvent = {
    type: 'typing',
    senderId: currentUserId,
    senderName: currentUserName,
    isTyping,
  };

  socket.value.send(JSON.stringify(payload));
  sentTypingState = isTyping;
}

function sendClientEvent(payload: ClientChatEvent) {
  if (!socket.value || socket.value.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.value.send(JSON.stringify(payload));
}

function handleClickExperimentEvent(payload: Extract<ClientChatEvent, { type: 'image-click' }>) {
  sendClientEvent({
    ...payload,
    type: 'image-click',
  });
}

function setReady(value: boolean | null) {
  isReady.value = value;
  sendClientEvent({
    type: 'ready-state',
    senderId: currentUserId,
    senderName: currentUserName,
    isReady: value,
  });
}

function toggleReady() {
  const nextReady = isReady.value === true ? null : true;
  setReady(nextReady);
}

function toggleHelp() {
  const nextReady = isReady.value === false ? null : false;
  setReady(nextReady);
}

function getCursorState() {
  return {
    cursorStart: draftInput.value?.selectionStart ?? null,
    cursorEnd: draftInput.value?.selectionEnd ?? null,
  };
}

function handleDraftInput() {
  sendClientEvent({
    type: 'draft-update',
    senderId: currentUserId,
    senderName: currentUserName,
    draft: draft.value,
    ...getCursorState(),
  });

  if (!draft.value.trim()) {
    window.clearTimeout(typingIdleTimer);
    emitTyping(false);
    return;
  }

  emitTyping(true);
  window.clearTimeout(typingIdleTimer);
  typingIdleTimer = window.setTimeout(() => {
    emitTyping(false);
  }, 1200);
}

function handleKeydown(event: KeyboardEvent) {
  sendClientEvent({
    type: 'keypress',
    senderId: currentUserId,
    senderName: currentUserName,
    key: event.key,
    code: event.code,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    draft: draft.value,
    ...getCursorState(),
  });
}

function handleCursorMove() {
  sendClientEvent({
    type: 'cursor-move',
    senderId: currentUserId,
    senderName: currentUserName,
    draft: draft.value,
    ...getCursorState(),
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
    senderName: currentUserName,
  };

  socket.value.send(JSON.stringify(payload));
  draft.value = '';
  window.clearTimeout(typingIdleTimer);
  emitTyping(false);
  draftInput.value!.focus();
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
  window.clearTimeout(typingIdleTimer);
  emitTyping(false);
  socket.value?.close();
});
</script>

<template>
  <main class="shell">
    <div class="chat-layout">
      <ClickExperiment
        :enabled="CLICK_EXPERIMENT"
        :sender-id="currentUserId"
        :sender-name="assignedSenderName"
        @click-event="handleClickExperimentEvent"
      />

      <section class="phone-frame" :class="{ disabled: !chatEnabled }">
        <div
          v-if="!chatEnabled"
          class="chat-disabled-overlay"
          role="alert"
          aria-live="polite"
        >
          <div class="chat-disabled-card">
            <p>Chat is currently disabled by an admin</p>
            <button
              class="button-toggle ready-toggle"
              type="button"
              :class="{ active: isReady == true }"
              :disabled="!isConnected"
              @click="toggleReady"
            >
              {{ isReady === true ? 'Ready!' : 'Mark as ready' }}
            </button>
            <button
              class="button-toggle help-toggle"
              type="button"
              :class="{ active: isReady === false }"
              :disabled="!isConnected"
              @click="toggleHelp"
            >
              {{ isReady === false ? 'Help requested!' : 'Request help' }}
            </button>
          </div>
        </div>

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

          <article
            v-for="name in Object.values(typingUsers)"
            :key="name"
            class="message-row"
          >
            <div class="bubble typing-bubble">
              <p class="sender">{{ name }}</p>
              <div class="typing-indicator" aria-label="Typing indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </article>
        </div>

        <form class="composer" @submit.prevent="sendMessage">
          <!--
          <button class="ghost-button" type="button" aria-label="Attach file">+</button>
          -->
          <label class="composer-field">
            <input
              ref="draftInput"
              v-model="draft"
              @input="handleDraftInput"
              @click="handleCursorMove"
              @keydown="handleKeydown"
              @keyup="handleCursorMove"
              @select="handleCursorMove"
              type="text"
              name="message"
              placeholder="Write a message"
              autocomplete="off"
              :disabled="!chatEnabled"
            />
          </label>
          <button class="send-button" type="submit" :disabled="disableSendMessage">
            Send
          </button>
        </form>
      </section>
    </div>
  </main>
</template>
