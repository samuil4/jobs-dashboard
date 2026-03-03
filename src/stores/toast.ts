import { defineStore } from 'pinia'
import { ref } from 'vue'

const TOAST_DURATION_MS = 4000

export const useToastStore = defineStore('toast', () => {
  const message = ref<string | null>(null)
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  function show(text: string) {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    message.value = text
    timeoutId = setTimeout(() => {
      message.value = null
      timeoutId = null
    }, TOAST_DURATION_MS)
  }

  function hide() {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    message.value = null
  }

  return {
    message,
    show,
    hide,
  }
})
