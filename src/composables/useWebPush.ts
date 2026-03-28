import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

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

export function useWebPush() {
  const authStore = useAuthStore()
  const permission = ref<NotificationPermission>('default')
  const isSupported = computed(
    () =>
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
  )
  const canRequestPermission = computed(() => permission.value === 'default')
  const isSubscribed = ref(false)
  const isSubscribing = ref(false)
  const error = ref<string | null>(null)

  function updatePermission() {
    if (typeof Notification !== 'undefined') {
      permission.value = Notification.permission
    }
  }

  async function subscribe(): Promise<boolean> {
    if (!isSupported.value) {
      error.value = 'Push notifications are not supported'
      return false
    }
    if (!authStore.isAuthenticated) {
      error.value = 'Sign in to enable push notifications'
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
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) {
        error.value = 'Service worker is not registered'
        isSubscribing.value = false
        return false
      }
      const existingSubscription = await registration.pushManager.getSubscription()
      if (existingSubscription) {
        await persistSubscription(existingSubscription)
        isSubscribed.value = true
        updatePermission()
        isSubscribing.value = false
        return true
      }

      const permissionResult = await Notification.requestPermission()
      updatePermission()
      if (permissionResult !== 'granted') {
        error.value = 'Notification permission denied'
        isSubscribing.value = false
        return false
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      })
      await persistSubscription(pushSubscription)
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

  async function persistSubscription(subscription: PushSubscription): Promise<void> {
    const userId = authStore.userId
    if (!userId) throw new Error('Not authenticated')

    const { error: insertError } = await supabase.from('push_subscriptions').insert({
      user_id: userId,
      subscription: subscription.toJSON(),
      updated_at: new Date().toISOString(),
    })

    if (insertError) throw insertError
  }

  async function checkSubscription() {
    if (!isSupported.value) return
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) {
        isSubscribed.value = false
        updatePermission()
        return
      }
      const subscription = await registration.pushManager.getSubscription()
      isSubscribed.value = !!subscription
    } catch {
      isSubscribed.value = false
    }
    updatePermission()
  }

  return {
    isSupported,
    canRequestPermission,
    permission,
    isSubscribed,
    isSubscribing,
    error,
    subscribe,
    checkSubscription,
    updatePermission,
  }
}
