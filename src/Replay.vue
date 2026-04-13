<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, Ref, ref } from 'vue';

const lines: Ref<Array<string>> = ref([]);
const events: Ref<Array<any>> = computed(() => {
  return lines.value.map(line => {
    try {
      return JSON.parse(line) as any;
    } catch (e) {
      return {};
    }
  })
});
const firstEventIndex = computed(() => lines.value.findIndex(e => e.length > 0 && e[0] == '{'));
const lastEventIndex = computed(() => lines.value.findLastIndex(e => e.length > 0 && e[0] == '{'));

const startTime = computed(() => new Date(events.value[firstEventIndex.value]?.timestamp) ?? '');
const endTime = computed(() => new Date(events.value[lastEventIndex.value]?.timestamp) ?? '');
const currentIndex = ref(0);

async function readFile(e: any) {
  console.log(fileInput.value);
  const files = fileInput.value?.files;
  if (files == null) return;
  const text = await files[0].text();
  lines.value = text.split("\n");
  console.log(lines.value.length);
}

const fileInput: Ref<HTMLInputElement | null> = ref(null);

</script>

<template>
  <main class="replay">
    <input type="file" @change="readFile" ref="fileInput" />
    <input type="range" :min="firstEventIndex" :max="lastEventIndex" v-model="currentIndex" />
    <div>
      <p>
        First last index: {{ firstEventIndex }}
        {{ lastEventIndex }}
      </p>
      <p>
        Times:<br />
        {{ startTime }}<br />
        {{ endTime }}
      </p>
      <p>
        Index: {{ currentIndex }}
      </p>
    </div>
  </main>
</template>
