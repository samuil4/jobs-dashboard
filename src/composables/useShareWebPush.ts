import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function useShareWebPush() {
  const permission = ref<NotificationPermission>('default')
  const isSupported = computed(
    () =>
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
  )
  const isSubscribed = ref(false)
  const isSubscribing = ref(false)
  const error = ref<string | null>(null)

  function updatePermission() {
    if (typeof Notification !== 'undefined') {
      permission.value = Notification.permission
    }
  }

  async function subscribe(jobId: string, shareToken: string): Promise<boolean> {
    if (!isSupported.value) {
      error.value = 'Push notifications are not supported'
      return false
    }
    if (!jobId || !shareToken) {
      error.value = 'Job and token required'
      return false
    }

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) {
      error.value = 'VAPID public key not configured'
      return false
    }

    isSubscribing.value = true
    error.value = null

    try {
      const registration = await navigator.serviceWorker.ready
      let pushSubscription = await registration.pushManager.getSubscription()

      if (!pushSubscription) {
        const permissionResult = await Notification.requestPermission()
        updatePermission()
        if (permissionResult !== 'granted') {
          error.value = 'Notification permission denied'
          isSubscribing.value = false
          return false
        }
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)
        pushSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        })
      } else {
        updatePermission()
      }

      const { data, error: invokeError } = await supabase.functions.invoke('register-share-push', {
        body: {
          job_id: jobId,
          share_token: shareToken,
          subscription: pushSubscription.toJSON(),
        },
      })

      if (invokeError) {
        error.value = invokeError.message
        isSubscribing.value = false
        return false
      }

      const result = data as { ok?: boolean; error?: string } | null
      if (result && !result.ok && result.error) {
        error.value = result.error
        isSubscribing.value = false
        return false
      }

      isSubscribed.value = true
      isSubscribing.value = false
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      error.value = msg
      isSubscribing.value = false
      return false
    }
  }

  async function checkSubscription() {
    if (!isSupported.value) return
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      isSubscribed.value = !!subscription
    } catch {
      isSubscribed.value = false
    }
    updatePermission()
  }

  return {
    isSupported,
    permission,
    isSubscribed,
    isSubscribing,
    error,
    subscribe,
    checkSubscription,
    updatePermission,
  }
}
