import { computed, ref } from 'vue'

const APP_VERSION_STORAGE_KEY = 'jobs-dashboard-app-version'

const buildVersion = __APP_VERSION__
const previousVersion = ref<string | null>(null)
const isRefreshing = ref(false)

function readStoredVersion() {
  if (typeof window === 'undefined') {
    previousVersion.value = buildVersion
    return
  }

  const storedVersion = window.localStorage.getItem(APP_VERSION_STORAGE_KEY)

  if (!storedVersion) {
    window.localStorage.setItem(APP_VERSION_STORAGE_KEY, buildVersion)
    previousVersion.value = buildVersion
    return
  }

  previousVersion.value = storedVersion
}

readStoredVersion()

export function useAppVersion() {
  const hasUpdate = computed(
    () => previousVersion.value !== null && previousVersion.value !== buildVersion
  )

  async function refreshApp() {
    if (typeof window === 'undefined' || isRefreshing.value) return

    isRefreshing.value = true

    try {
      window.localStorage.setItem(APP_VERSION_STORAGE_KEY, buildVersion)
      previousVersion.value = buildVersion

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(
          registrations.map(async (registration) => {
            try {
              await registration.update()
            } catch (error) {
              console.warn('Failed to refresh service worker registration', error)
            }
          })
        )
      }

      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.set('appVersion', buildVersion)
      window.location.replace(nextUrl.toString())
    } finally {
      isRefreshing.value = false
    }
  }

  return {
    buildVersion,
    previousVersion,
    hasUpdate,
    isRefreshing,
    refreshApp,
  }
}
