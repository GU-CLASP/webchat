<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import pic1a from './pic1a.png';
import pic2a from './pic2a.png';
import pic1b from './pic1b.png';
import pic2b from './pic2b.png';

type ClickExperimentEvent = {
  type: 'image-click';
  senderId: string;
  imageId: 'pic1' | 'pic2';
  x: number;
  y: number;
  action: 'add' | 'remove';
};

type Marker = {
  id: string;
  x: number;
  y: number;
};

const props = defineProps<{
  enabled: boolean;
  scenario: string;
  senderId: string;
  senderName: string | null;
}>();

const emit = defineEmits<{
  clickEvent: [payload: ClickExperimentEvent];
}>();

const markers = ref<Record<'pic1' | 'pic2', Marker[]>>({
  pic1: [],
  pic2: [],
});
const isPhone = ref(false);

const images = [
  {
    id: 'pic1' as const,
    label: 'Person1',
    scenario: 'a',
    src: pic1a,
  },
  {
    id: 'pic2' as const,
    label: 'Person2',
    scenario: 'a',
    src: pic2a,
  },
  {
    id: 'pic1' as const,
    label: 'Person1',
    scenario: 'b',
    src: pic1b,
  },
  {
    id: 'pic2' as const,
    label: 'Person2',
    scenario: 'b',
    src: pic2b,
  },
];

const shouldShow = computed(() => props.enabled && !isPhone.value);
const visibleImage = computed(() => images.find((image) => image.label === props.senderName && image.scenario == props.scenario) ?? null);

function updateDeviceState() {
  isPhone.value =
    window.matchMedia('(max-width: 640px)').matches ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function buildMarkerId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function addMarker(imageId: 'pic1' | 'pic2', event: MouseEvent) {
  const currentTarget = event.currentTarget;
  if (!(currentTarget instanceof HTMLElement)) {
    return;
  }

  const bounds = currentTarget.getBoundingClientRect();
  const x = Number((((event.clientX - bounds.left) / bounds.width) * 100).toFixed(2));
  const y = Number((((event.clientY - bounds.top) / bounds.height) * 100).toFixed(2));

  markers.value = {
    ...markers.value,
    [imageId]: [
      ...markers.value[imageId],
      {
        id: buildMarkerId(),
        x,
        y,
      },
    ],
  };

  emit('clickEvent', {
    type: 'image-click',
    senderId: props.senderId,
    imageId,
    x,
    y,
    action: 'add',
  });
}

function removeMarker(imageId: 'pic1' | 'pic2', markerId: string) {
  const marker = markers.value[imageId].find((entry) => entry.id === markerId);
  if (!marker) {
    return;
  }

  markers.value = {
    ...markers.value,
    [imageId]: markers.value[imageId].filter((entry) => entry.id !== markerId),
  };

  emit('clickEvent', {
    type: 'image-click',
    senderId: props.senderId,
    imageId,
    x: marker.x,
    y: marker.y,
    action: 'remove',
  });
}

onMounted(() => {
  updateDeviceState();
  window.addEventListener('resize', updateDeviceState);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateDeviceState);
});
</script>

<template>
  <section v-if="shouldShow" class="click-experiment" aria-label="Click experiment">
    <article
      v-if="visibleImage"
      class="click-card"
    >
      <header class="click-card-header">
        <h2>{{ visibleImage.label }}</h2>
        <p>Click to add a marker. Click a marker to remove it.</p>
      </header>

      <button
        type="button"
        class="click-surface"
        @click="addMarker(visibleImage.id, $event)"
      >
        <img :src="visibleImage.src" :alt="`${visibleImage.label} reference`" />
        <span
          v-for="marker in markers[visibleImage.id]"
          :key="marker.id"
          class="click-marker"
          :style="{
            left: `${marker.x}%`,
            top: `${marker.y}%`,
          }"
          @click.stop="removeMarker(visibleImage.id, marker.id)"
        />
      </button>
    </article>
  </section>
</template>

<style scoped>
.click-experiment {
  width: 100%;
  display: grid;
  gap: 14px;
}

.click-card {
  padding: 14px;
  border-radius: 28px;
  background: rgba(247, 251, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 18px 48px rgba(41, 92, 137, 0.16);
}

.click-card-header h2,
.click-card-header p {
  margin: 0;
}

.click-card-header h2 {
  font-size: 0.95rem;
  color: #24445f;
}

.click-card-header p {
  margin-top: 4px;
  font-size: 0.8rem;
  color: #58758d;
}

.click-surface {
  position: relative;
  width: 100%;
  margin-top: 12px;
  padding: 0;
  border: 0;
  border-radius: 20px;
  overflow: hidden;
  cursor: crosshair;
  background: #dcebf5;
}

.click-surface img {
  display: block;
  width: 100%;
  height: auto;
}

.click-marker {
  position: absolute;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 3px solid #fff;
  background: rgba(219, 71, 71, 0.9);
  box-shadow: 0 8px 20px rgba(90, 28, 28, 0.25);
  transform: translate(-50%, -50%);
}
</style>
