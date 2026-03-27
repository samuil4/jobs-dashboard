<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import JobShareCard from '../components/JobShareCard.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import { usePwaInstall } from '../composables/usePwaInstall'
import { useShareWebPush } from '../composables/useShareWebPush'
import { getJobShareData } from '../lib/shareApi'
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
const { canInstall, isInstalled, isInstalling, install } = usePwaInstall()
const {
  isSupported: sharePushSupported,
  isSubscribed: sharePushSubscribed,
  isSubscribing: sharePushSubscribing,
  error: sharePushError,
  subscribe: subscribeSharePush,
  checkSubscription: checkSharePushSubscription,
} = useShareWebPush()

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

async function pollJobData() {
  const jid = jobId.value
  const tok = shareToken.value
  if (!jid || !tok) return
  const result = await getJobShareData(jid, tok)
  console.log('pollJobData', result)
  if (result.job) {
    job.value = result.job
  }
}

function startPolling() {
  if (pollTimer) return
  if (!jobId.value || !shareToken.value) return
  pollJobData()
  pollTimer = setInterval(pollJobData, POLL_INTERVAL_MS)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

watch([unlocked, shareToken], ([u, tok]) => {
  if (u && tok) {
    startPolling()
  } else {
    stopPolling()
  }
})

onMounted(() => {
  if (unlocked.value && shareToken.value) {
    startPolling()
  }
  if (sharePushSupported) {
    checkSharePushSubscription()
  }
})

onUnmounted(() => {
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

async function handleEnableSharePush() {
  const tok = shareToken.value
  if (!jobId.value || !tok) return
  const ok = await subscribeSharePush(jobId.value, tok)
  if (!ok && sharePushError.value) {
    toast.error(sharePushError.value)
  } else if (ok) {
    toast.success(t('webPush.enabled'))
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
</script>

<template>
  <div class="job-share-view">
    <header class="share-header">
      <div class="share-header-content">
        <h1 class="share-title">{{ t('share.title') }}</h1>
        <LanguageSwitcher />
      </div>
    </header>

    <main class="share-content">
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
        <footer v-if="job" class="share-footer">
          <div class="share-footer-actions">
            <button
              v-if="canInstall && !isInstalled"
              class="btn btn-compact btn-secondary"
              type="button"
              :disabled="isInstalling"
              @click="install"
            >
              {{ isInstalling ? t('pwa.installing') : t('pwa.install') }}
            </button>
            <button
              v-if="sharePushSupported && !sharePushSubscribed && shareToken"
              class="btn btn-compact btn-secondary"
              type="button"
              :disabled="sharePushSubscribing"
              :title="sharePushError ?? undefined"
              @click="handleEnableSharePush"
            >
              {{ sharePushSubscribing ? t('webPush.enabling') : t('webPush.enable') }}
            </button>
          </div>
        </footer>
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

.share-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.share-footer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.btn-compact {
  font-size: 14px;
  padding: 8px 14px;
}
</style>
