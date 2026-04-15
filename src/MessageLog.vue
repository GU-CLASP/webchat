<script setup lang="ts">
import { formatTime } from '@shared/admin';
import { Message } from '@shared/chat';

defineProps<{
  messages: Message[],
}>()

</script>
<template>
  <div class="message-feed">
    <article v-for="message in messages" :key="message.id" class="message-card">
      <div class="message-card-head">
        <strong>{{ message.senderName }}</strong>
        <span>{{ formatTime(message.sentAt) }}</span>
      </div>
      <p>{{ message.content }}</p>
    </article>
  </div>
</template>
