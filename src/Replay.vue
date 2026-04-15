<script setup lang="ts">
import { ParticipantState } from '@shared/admin';
import { computed, ComputedRef, onBeforeUnmount, ref, type Ref } from 'vue';
import ParticipantCard from "./ParticipantCard.vue";

type ReplayEvent = {
  raw: Record<string, unknown>;
  index: number;
  timestamp: string;
  timeMs: number;
};

const lines: Ref<string[]> = ref([]);
const fileInput: Ref<HTMLInputElement | null> = ref(null);
const currentTime = ref<number | null>(null);
const isPlaying = ref(false);
const playbackSpeed = ref(1);

let playbackFrame: number | null = null;
let lastFrameAt: number | null = null;

const playbackSpeeds = [0.25, 0.5, 1, 1.5, 2, 4];
const skipAmountMs = 5_000;

const parsedEvents = computed<ReplayEvent[]>(() =>
  lines.value.flatMap((line, index) => {
    if (!line.trim().startsWith('{')) {
      return [];
    }

    try {
      const raw = JSON.parse(line) as Record<string, unknown>;
      const timestamp = typeof raw.timestamp === 'string' ? raw.timestamp : '';
      const timeMs = Number(new Date(timestamp));

      if (!timestamp || Number.isNaN(timeMs)) {
        return [];
      }

      return [{ raw, index, timestamp, timeMs }];
    } catch {
      return [];
    }
  }),
);

const firstEvent = computed(() => parsedEvents.value[0] ?? null);
const lastEvent = computed(() => parsedEvents.value.at(-1) ?? null);
const startTime = computed(() => firstEvent.value?.timeMs ?? null);
const endTime = computed(() => lastEvent.value?.timeMs ?? null);
const durationMs = computed(() => {
  if (startTime.value === null || endTime.value === null) {
    return 0;
  }

  return Math.max(endTime.value - startTime.value, 0);
});

const currentIndex = computed(() => {
  if (currentTime.value === null) {
    return -1;
  }

  for (let index = parsedEvents.value.length - 1; index >= 0; index -= 1) {
    if (parsedEvents.value[index].timeMs <= currentTime.value) {
      return parsedEvents.value[index].index;
    }
  }

  return parsedEvents.value[0]?.index ?? -1;
});

const activeEvent = computed(() => {
  if (currentTime.value === null) {
    return null;
  }
  return parsedEvents.value[currentIndex.value] ?? null;
});

const participantIds = computed(() => {
  const set = new Set(parsedEvents.value.map(e => e.raw.senderId as string ?? ""));
  return Array.from(set);
});

const participantStates = computed(() => {
  const index = currentIndex.value;
  const ids = participantIds.value;
  const states: Record<string, ParticipantState> = {};

  for (const id of ids) {
    if (id === '') continue;
    const props = new Set(['senderId', 'senderName', 'isTyping', 'draft', 'cursorStart', 'cursorEnd']);
    const state: Record<string, any> = {
      draft: "",
      senderId: id,
      senderName: "(Unknown)",
      isTyping: false,
      cursorStart: 0,
      cursorEnd: 0,
    };

    for (let i = index; i >= 0; i--) {
      if (parsedEvents.value[i]?.raw?.senderId === id) {
        const event = parsedEvents.value[i].raw;
        for (const prop of Array.from(props)) {
          if (prop === "draft" && event.event === "message") {
            state.draft = "";
            props.delete(prop);
          } else if (event[prop] !== undefined) {
            state[prop] = event[prop];
            props.delete(prop);
          }
        }
      }
    }
    states[id] = state as ParticipantState;
  }
  return Object.values(states).sort((left, right) =>
    right.senderId.localeCompare(left.senderId),
  );
});

const elapsedMs = computed(() => {
  if (currentTime.value === null || startTime.value === null) {
    return 0;
  }

  return Math.max(currentTime.value - startTime.value, 0);
});

function clampTime(nextTime: number) {
  if (startTime.value === null || endTime.value === null) {
    return nextTime;
  }

  return Math.min(Math.max(nextTime, startTime.value), endTime.value);
}

function setCurrentTime(nextTime: number | null) {
  if (nextTime === null) {
    currentTime.value = null;
    return;
  }

  currentTime.value = clampTime(nextTime);
}

function stopPlayback() {
  isPlaying.value = false;
  lastFrameAt = null;

  if (playbackFrame !== null) {
    window.cancelAnimationFrame(playbackFrame);
    playbackFrame = null;
  }
}

function tickPlayback(frameAt: number) {
  if (!isPlaying.value || currentTime.value === null) {
    stopPlayback();
    return;
  }

  if (lastFrameAt === null) {
    lastFrameAt = frameAt;
  }

  const frameDelta = frameAt - lastFrameAt;
  lastFrameAt = frameAt;

  const nextTime = clampTime(currentTime.value + frameDelta * playbackSpeed.value);
  currentTime.value = nextTime;

  if (endTime.value !== null && nextTime >= endTime.value) {
    stopPlayback();
    return;
  }

  playbackFrame = window.requestAnimationFrame(tickPlayback);
}

function play() {
  if (currentTime.value === null) {
    return;
  }

  if (endTime.value !== null && currentTime.value >= endTime.value && startTime.value !== null) {
    currentTime.value = startTime.value;
  }

  if (isPlaying.value) {
    return;
  }

  isPlaying.value = true;
  lastFrameAt = null;
  playbackFrame = window.requestAnimationFrame(tickPlayback);
}

function pause() {
  stopPlayback();
}

function skipBy(offsetMs: number) {
  if (currentTime.value === null) {
    return;
  }

  setCurrentTime(currentTime.value + offsetMs);
}

function resetReplayState() {
  stopPlayback();
  currentTime.value = startTime.value;
}

async function readFile() {
  const files = fileInput.value?.files;
  if (!files?.length) {
    return;
  }

  const text = await files[0].text();
  lines.value = text.split('\n');
  resetReplayState();
}

function formatTimestamp(value: number | null) {
  if (value === null) {
    return 'No timestamp';
  }

  return new Intl.DateTimeFormat([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function formatDuration(value: number) {
  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, '0')))
    .join(':');
}

onBeforeUnmount(() => {
  stopPlayback();
});
</script>

<template>
  <main class="replay">
    <section class="replay-panel">
      <div class="header">
        <div>
          <p class="eyebrow">Replay Timeline</p>
          <h1>Session Playback</h1>
        </div>
        <input type="file" @change="readFile" ref="fileInput" />
      </div>

      <div class="timeline-card">
        <div class="timeline-header">
          <div>
            <span class="label">Start</span>
            <p>{{ formatTimestamp(startTime) }}</p>
          </div>
          <div>
            <span class="label">Current</span>
            <p>{{ formatTimestamp(currentTime) }}</p>
          </div>
          <div>
            <span class="label">End</span>
            <p>{{ formatTimestamp(endTime) }}</p>
          </div>
          <div>
            <span class="label">Duration</span>
            <p>{{ formatDuration(durationMs) }}</p>
          </div>
        </div>

        <input
          class="timeline-slider"
          type="range"
          :min="startTime ?? 0"
          :max="endTime ?? 0"
          :step="1000"
          :disabled="currentTime === null"
          :value="currentTime ?? 0"
          @input="setCurrentTime(Number(($event.target as HTMLInputElement).value))"
        />

        <div class="timeline-footer">
          <span>{{ formatDuration(elapsedMs) }}</span>
          <span>{{ formatDuration(Math.max(durationMs - elapsedMs, 0)) }} remaining</span>
        </div>

        <div class="controls">
          <button type="button" @click="skipBy(-skipAmountMs)" :disabled="currentTime === null">
            -5s
          </button>
          <button type="button" @click="play" :disabled="currentTime === null || isPlaying">
            Play
          </button>
          <button type="button" @click="pause" :disabled="!isPlaying">
            Pause
          </button>
          <button type="button" @click="skipBy(skipAmountMs)" :disabled="currentTime === null">
            +5s
          </button>

          <label class="speed-control">
            <span>Speed</span>
            <select v-model.number="playbackSpeed" :disabled="currentTime === null">
              <option v-for="speed in playbackSpeeds" :key="speed" :value="speed">
                {{ speed }}x
              </option>
            </select>
          </label>
        </div>
      </div>

      <div class="details-grid">
        <article class="detail-card">
          <span class="label">Active event index</span>
          <p>{{ currentIndex >= 0 ? currentIndex : 'No active event' }}</p>
        </article>

        <article class="detail-card">
          <span class="label">Active event timestamp</span>
          <p>{{ activeEvent?.timestamp ?? 'No active event' }}</p>
        </article>
        <!--
        <article class="detail-card detail-card-wide">
          <span class="label">Active event payload</span>
          <pre>{{ activeEvent ? JSON.stringify(activeEvent.raw, null, 2) : 'Load a replay file to begin.' }}</pre>
        </article>
        -->
      </div>
    </section>
    <section class="admin-grid">
      <ParticipantCard v-for="participant in participantStates" :key="participant.senderId"
        :allowHelpRequestedChip="false"
        :participant="participant"
        :showKeypress="false"
      />
    </section>
  </main>
</template>

<style scoped>
.replay {
  min-height: 100vh;
  padding: 32px 20px;
}

.replay-panel {
  width: min(100%, 980px);
  margin: 0 auto;
  display: grid;
  gap: 20px;
}

.header,
.timeline-card,
.detail-card {
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 50px rgba(56, 93, 124, 0.12);
  backdrop-filter: blur(12px);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 16px;
  padding: 24px 28px;
}

.eyebrow,
.label {
  margin: 0;
  color: #5e7f97;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.header h1,
.timeline-header p,
.detail-card p {
  margin: 0;
}

.timeline-card {
  padding: 24px 28px;
}

.timeline-header {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  margin-bottom: 18px;
}

.timeline-slider {
  width: 100%;
  margin: 6px 0;
}

.timeline-footer {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: 8px;
  color: #486278;
  font-size: 0.92rem;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-top: 20px;
}

.controls button,
.speed-control select,
.header input[type='file'] {
  min-height: 42px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
}

.controls button,
.speed-control select {
  background: #dcecf8;
  color: #1f3a52;
}

.controls button:disabled,
.speed-control select:disabled {
  opacity: 0.6;
}

.speed-control {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  color: #365066;
  font-weight: 700;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
}

.detail-card {
  padding: 20px 24px;
}

.detail-card-wide {
  grid-column: 1 / -1;
}

.detail-card pre {
  margin: 10px 0 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 720px) {
  .header {
    align-items: start;
    flex-direction: column;
  }

  .timeline-footer {
    flex-direction: column;
  }

  .speed-control {
    margin-left: 0;
  }
}
</style>
