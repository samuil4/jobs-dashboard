import { computed, onScopeDispose, ref } from 'vue'

const BUILD_META_PATH = '/build-meta.json'
const POLL_MS = 5 * 60 * 1000

type BuildMeta = { version: string; buildId: string }

const buildVersion = __APP_VERSION__
const bundledBuildId = __APP_BUILD_ID__

const remoteVersion = ref<string | null>(null)
const remoteBuildId = ref<string | null>(null)
const isRefreshing = ref(false)

let watcherRefCount = 0
let pollTimer: ReturnType<typeof setInterval> | null = null

function stopUpdateWatcher() {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('focus', fetchRemoteBuildMeta)
}

function onVisibility() {
  if (document.visibilityState === 'visible') {
    void fetchRemoteBuildMeta()
  }
}

async function fetchRemoteBuildMeta() {
  if (typeof window === 'undefined') return
  try {
    const response = await fetch(`${BUILD_META_PATH}?_=${Date.now()}`, {
      cache: 'no-store',
    })
    if (!response.ok) return
    const data = (await response.json()) as BuildMeta
    if (typeof data.buildId === 'string' && typeof data.version === 'string') {
      remoteBuildId.value = data.buildId
      remoteVersion.value = data.version
    }
  } catch {
    // offline or blocked
  }
}

function startUpdateWatcher() {
  if (typeof window === 'undefined' || pollTimer !== null) return
  void fetchRemoteBuildMeta()
  pollTimer = setInterval(() => {
    void fetchRemoteBuildMeta()
  }, POLL_MS)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', fetchRemoteBuildMeta)
}

function migrateLegacyVersionStorage() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem('jobs-dashboard-app-version')
  } catch {
    // ignore
  }
}

migrateLegacyVersionStorage()

export function shortBuildId(buildId: string) {
  if (buildId === 'dev') return 'dev'
  return buildId.length > 7 ? buildId.slice(0, 7) : buildId
}

export function formatDeployLabel(version: string, buildId: string) {
  return `v${version} (${shortBuildId(buildId)})`
}

export function useAppVersion() {
  watcherRefCount += 1
  if (watcherRefCount === 1) {
    startUpdateWatcher()
  }

  onScopeDispose(() => {
    watcherRefCount -= 1
    if (watcherRefCount <= 0) {
      watcherRefCount = 0
      stopUpdateWatcher()
    }
  })

  const hasUpdate = computed(
    () =>
      remoteBuildId.value !== null &&
      remoteBuildId.value !== bundledBuildId &&
      remoteVersion.value !== null,
  )

  const updateCurrentLabel = computed(() => formatDeployLabel(buildVersion, bundledBuildId))

  const updateNextLabel = computed(() => {
    if (remoteVersion.value === null || remoteBuildId.value === null) return ''
    return formatDeployLabel(remoteVersion.value, remoteBuildId.value)
  })

  async function refreshApp() {
    if (typeof window === 'undefined' || isRefreshing.value) return

    isRefreshing.value = true

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(
          registrations.map(async (registration) => {
            try {
              await registration.update()
              const targetWorker = registration.waiting ?? registration.active
              targetWorker?.postMessage({ type: 'SKIP_WAITING' })
            } catch (error) {
              console.warn('Failed to refresh service worker registration', error)
            }
          }),
        )
      }

      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.set('appVersion', buildVersion)
      nextUrl.searchParams.set('buildId', bundledBuildId)
      nextUrl.searchParams.set('_cb', String(Date.now()))
      window.location.replace(nextUrl.toString())
    } finally {
      isRefreshing.value = false
    }
  }

  return {
    buildVersion,
    bundledBuildId,
    remoteVersion,
    remoteBuildId,
    hasUpdate,
    isRefreshing,
    updateCurrentLabel,
    updateNextLabel,
    refreshApp,
  }
}
