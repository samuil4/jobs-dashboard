<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import AppFooterBar from '../components/AppFooterBar.vue'
import JobShareCard from '../components/JobShareCard.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import { getJobShareData } from '../lib/shareApi'
import { useAuthStore } from '../stores/auth'
import { isValidJobId, verifyJobSharePassword } from '../lib/share'
import type { JobShareData } from '../types/job'

const SHARE_ACCESS_KEY = 'job-share-access'
const TTL_MS = 72 * 60 * 60 * 1000 // 72 hours
const POLL_INTERVAL_MS = 30_000

interface StoredAccess {
  jobId: string
  job: JobShareData
  shareToken?: string
  expiresAt: number
}

function getStoredAccess(jobId: string): {
  valid: boolean
  job?: JobShareData
  shareToken?: string
} {
  try {
    const raw = sessionStorage.getItem(SHARE_ACCESS_KEY)
    if (!raw) return { valid: false }
    const data = JSON.parse(raw) as StoredAccess
    if (data.jobId !== jobId) return { valid: false }
    if (Date.now() >= data.expiresAt) {
      sessionStorage.removeItem(SHARE_ACCESS_KEY)
      return { valid: false }
    }
    return { valid: true, job: data.job, shareToken: data.shareToken }
  } catch {
    return { valid: false }
  }
}

function setStoredAccess(jobId: string, jobData: JobShareData, shareToken?: string) {
  sessionStorage.setItem(
    SHARE_ACCESS_KEY,
    JSON.stringify({
      jobId,
      job: jobData,
      shareToken,
      expiresAt: Date.now() + TTL_MS,
    }),
  )
}

const route = useRoute()
const { t } = useI18n()
const authStore = useAuthStore()

const jobId = computed(() => (route.params.jobId as string) ?? '')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const unlocked = ref(false)
const job = ref<JobShareData | null>(null)
const shareToken = ref<string | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

watch(
  jobId,
  (id) => {
    if (!id) return
    unlocked.value = false
    job.value = null
    shareToken.value = null
    password.value = ''
    error.value = null
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    const stored = getStoredAccess(id)
    if (stored.valid && stored.job) {
      unlocked.value = true
      job.value = stored.job
      shareToken.value = stored.shareToken ?? null
    }
  },
  { immediate: true },
)

type PollSource = 'initial' | 'interval' | 'visibility'

async function pollJobData(source: PollSource = 'interval') {
  const jid = jobId.value
  const tok = shareToken.value
  if (!jid || !tok) {
    console.log('[JobShare poll] skipped (no job id or token)', { source, jid, hasToken: Boolean(tok) })
    return
  }
  console.log('[JobShare poll] request', { source, jobId: jid })
  const result = await getJobShareData(jid, tok)
  if (result.error) {
    console.warn('[JobShare poll] API error', { source, error: result.error })
    return
  }
  if (result.job) {
    const prev = job.value
    const next = result.job
    const changed =
      !prev ||
      prev.parts_produced !== next.parts_produced ||
      prev.parts_overproduced !== next.parts_overproduced ||
      prev.delivered !== next.delivered ||
      prev.parts_needed !== next.parts_needed
    console.log('[JobShare poll] job update', {
      source,
      changed,
      previous: prev
        ? {
            parts_needed: prev.parts_needed,
            parts_produced: prev.parts_produced,
            parts_overproduced: prev.parts_overproduced,
            delivered: prev.delivered,
          }
        : null,
      next: {
        parts_needed: next.parts_needed,
        parts_produced: next.parts_produced,
        parts_overproduced: next.parts_overproduced,
        delivered: next.delivered,
      },
    })
    job.value = next
    setStoredAccess(jid, next, tok)
  } else {
    console.warn('[JobShare poll] empty job in response', { source })
  }
}

function startPolling() {
  if (pollTimer) return
  if (!jobId.value || !shareToken.value) return
  console.log('[JobShare] polling started', {
    jobId: jobId.value,
    intervalMs: POLL_INTERVAL_MS,
  })
  void pollJobData('initial')
  pollTimer = setInterval(() => void pollJobData('interval'), POLL_INTERVAL_MS)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

watch(
  [unlocked, shareToken],
  ([u, tok]) => {
    if (u && tok) {
      startPolling()
    } else {
      stopPolling()
    }
  },
  { immediate: true },
)

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && unlocked.value && shareToken.value) {
    void pollJobData('visibility')
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  stopPolling()
})

async function handlePasswordSubmit() {
  if (!jobId.value || !password.value.trim()) {
    error.value = t('share.passwordRequired')
    return
  }
  if (!isValidJobId(jobId.value)) {
    error.value = t('share.invalidLink')
    return
  }
  loading.value = true
  error.value = null
  try {
    const result = await verifyJobSharePassword(jobId.value, password.value.trim())
    if (result.valid && result.job) {
      const token = result.shareToken ?? ''
      setStoredAccess(jobId.value, result.job, token)
      job.value = result.job
      shareToken.value = token || null
      unlocked.value = true
    } else {
      error.value = t('share.invalidPassword')
    }
  } catch (err) {
    console.error(err)
    error.value = t('share.invalidPassword')
  } finally {
    loading.value = false
  }
}

function handleCopyLink() {
  const url = `${window.location.origin}${window.location.pathname}`
  navigator.clipboard
    .writeText(url)
    .then(() => {
      // Brief feedback could be shown here
    })
    .catch(() => {})
}

function leaveShareSession() {
  sessionStorage.removeItem(SHARE_ACCESS_KEY)
  unlocked.value = false
  job.value = null
  shareToken.value = null
  password.value = ''
  error.value = null
  stopPolling()
  console.log('[JobShare] left share session', { jobId: jobId.value })
}
</script>

<template>
  <div class="job-share-view">
    <header class="share-header">
      <div class="share-header-content">
        <h1 class="share-title">{{ t('share.title') }}</h1>
        <LanguageSwitcher v-if="!unlocked" />
      </div>
    </header>

    <main class="share-content" :class="{ 'share-content--with-footer': unlocked && job }">
      <template v-if="!jobId">
        <p class="share-error">{{ t('share.invalidLink') }}</p>
      </template>

      <template v-else-if="!isValidJobId(jobId)">
        <p class="share-error">{{ t('share.invalidLink') }}</p>
      </template>

      <template v-else-if="!unlocked">
        <div class="share-gate card">
          <h2>{{ t('share.enterPassword') }}</h2>
          <form class="share-form" @submit.prevent="handlePasswordSubmit">
            <label for="share-password" class="visually-hidden">
              {{ t('share.passwordLabel') }}
            </label>
            <input
              id="share-password"
              v-model="password"
              type="password"
              :placeholder="t('share.passwordPlaceholder')"
              autocomplete="current-password"
              class="share-input"
              :disabled="loading"
            />
            <p v-if="error" class="share-error-inline">{{ error }}</p>
            <button class="btn btn-primary" type="submit" :disabled="loading">
              {{ loading ? t('common.loading') + '…' : t('share.submit') }}
            </button>
          </form>
        </div>
      </template>

      <template v-else>
        <JobShareCard v-if="job" :job="job" @copy-link="handleCopyLink" />
        <AppFooterBar
          v-if="job"
          :push-mode="authStore.isAuthenticated ? 'auth' : 'share'"
          :share-job-id="jobId"
          :share-token="shareToken"
          :show-logout="authStore.isAuthenticated"
          show-leave-share
          @leave-share="leaveShareSession"
        />
      </template>
    </main>
  </div>
</template>

<style scoped>
.job-share-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #f9fafb 0%, #eceff4 100%);
}

.share-header {
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.share-header-content {
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.share-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.share-content {
  flex: 1;
  padding: 32px 24px;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

.share-content--with-footer {
  padding-bottom: 64px;
}

.share-gate {
  max-width: 360px;
}

.share-gate h2 {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.share-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.share-input {
  width: 100%;
  height: 44px;
  padding: 10px 14px;
  font-size: 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  margin: 0;
}

.share-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.share-input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.share-error-inline {
  margin: 0;
  font-size: 14px;
  color: #dc2626;
}

.share-error {
  margin: 0;
  color: #dc2626;
  font-size: 16px;
}

.visually-hidden {
  position: absolute;
  clip: rect(0 0 0 0);
  width: 1px;
  height: 1px;
  margin: -1px;
  border: 0;
  padding: 0;
  overflow: hidden;
}

</style>
