<script setup lang="ts">
import { ParticipantState, formatTime } from '@shared/admin';

defineProps<{
  participant: ParticipantState,
  showPreparationChips: boolean,
  showKeypress: boolean,
}>()

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


</script>
<template>
  <article class="admin-card">
    <div class="admin-card-head">
      <div>
        <h2>{{ participant.senderName }}</h2>
        <p class="participant-id">{{ participant.senderId }}</p>
      </div>
      <div class="participant-chips">
        <span v-if="participant.isReady === false && showPreparationChips" class="chip help-chip active">
            Help Requested
        </span>
        <span v-if="showPreparationChips" class="chip ready-chip" :class="{ active: participant.isReady }">
            {{ participant.isReady ? 'Ready' : 'Not ready' }}
        </span>
        <span class="chip typing-chip" :class="{ active: participant.isTyping }">
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

    <div class="field" v-if="showKeypress">
      <span class="label">Last Keypress</span>
      <p v-if="participant.lastKeypress">
        {{ participant.lastKeypress.key }} ({{ participant.lastKeypress.code }}) at
        {{ formatTime(participant.lastKeypress.at) }}
      </p>
      <p v-else>No keypress captured yet</p>
    </div>

    <div class="field meta-grid">
      <div v-if="participant.connectedAt">
        <span class="label">Connected</span>
        <p>{{ formatTime(participant.connectedAt) }}</p>
      </div>
      <div v-if="participant.lastSeenAt">
        <span class="label">Last Seen</span>
        <p>{{ formatTime(participant.lastSeenAt) }}</p>
      </div>
    </div>
  </article>
</template>
