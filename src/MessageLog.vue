<script setup lang="ts">
import { formatTime } from '@shared/admin';
import { Message } from '@shared/chat';
import { nextTick, ref, watch } from 'vue';

const props = defineProps<{
  messages: Message[],
}>()
const messagesElement = ref<HTMLElement | null>(null);

watch(() => props.messages.length, (newVal, oldVal) => {
  nextTick(() => {
    if (!messagesElement.value) {
      return;
    }
    messagesElement.value.scrollTo({
      top: messagesElement.value.scrollHeight,
      behavior: 'smooth',
    });
  });
})
</script>
<template>
  <div class="message-feed" ref="messagesElement">
    <article v-for="message in messages" :key="message.id" class="message-card">
      <div class="message-card-head">
        <strong>{{ message.senderName }}</strong>
        <span>{{ formatTime(message.sentAt) }}</span>
      </div>
      <p>{{ message.content }}</p>
    </article>
  </div>
</template>
