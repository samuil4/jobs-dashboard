<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useToastStore } from '../stores/toast'

const toastStore = useToastStore()
const { message } = storeToRefs(toastStore)
</script>

<template>
  <Transition name="toast">
    <div
      v-if="message"
      class="toast"
      role="status"
      aria-live="polite"
    >
      {{ message }}
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  bottom: 72px;
  left: 50%;
  transform: translateX(-50%);
  max-width: min(400px, calc(100vw - 32px));
  padding: 12px 20px;
  background: #1f2937;
  color: #fff;
  font-size: 14px;
  line-height: 1.4;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
