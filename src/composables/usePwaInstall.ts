import { ref, computed, readonly } from 'vue'

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

const installPromptEvent = ref<BeforeInstallPromptEvent | null>(null)
const isInstalled = ref(
  typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
)

function handleBeforeInstallPrompt(e: Event) {
  e.preventDefault()
  installPromptEvent.value = e as BeforeInstallPromptEvent
}

function handleAppInstalled() {
  installPromptEvent.value = null
  isInstalled.value = true
}

if (typeof window !== 'undefined') {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.removeEventListener('appinstalled', handleAppInstalled)
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)
}

const isInstalling = ref(false)

export function usePwaInstall() {
  const canInstall = computed(() => !!installPromptEvent.value)

  async function install(): Promise<boolean> {
    if (!installPromptEvent.value) return false
    isInstalling.value = true
    try {
      await installPromptEvent.value.prompt()
      const { outcome } = await installPromptEvent.value.userChoice
      if (outcome === 'accepted') {
        installPromptEvent.value = null
        isInstalled.value = true
        return true
      }
      return false
    } catch (err) {
      console.warn('PWA install failed:', err)
      return false
    } finally {
      isInstalling.value = false
    }
  }

  return {
    canInstall,
    isInstalled: readonly(isInstalled),
    isInstalling,
    install,
  }
}
