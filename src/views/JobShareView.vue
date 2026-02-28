<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import JobShareCard from '../components/JobShareCard.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import { isValidJobId, verifyJobSharePassword } from '../lib/share'
import type { JobShareData } from '../types/job'

const SHARE_ACCESS_KEY = 'job-share-access'
const TTL_MS = 72 * 60 * 60 * 1000 // 72 hours

interface StoredAccess {
  jobId: string
  job: JobShareData
  expiresAt: number
}

function getStoredAccess(jobId: string): { valid: boolean; job?: JobShareData } {
  try {
    const raw = sessionStorage.getItem(SHARE_ACCESS_KEY)
    if (!raw) return { valid: false }
    const data = JSON.parse(raw) as StoredAccess
    if (data.jobId !== jobId) return { valid: false }
    if (Date.now() >= data.expiresAt) {
      sessionStorage.removeItem(SHARE_ACCESS_KEY)
      return { valid: false }
    }
    return { valid: true, job: data.job }
  } catch {
    return { valid: false }
  }
}

function setStoredAccess(jobId: string, jobData: JobShareData) {
  sessionStorage.setItem(
    SHARE_ACCESS_KEY,
    JSON.stringify({
      jobId,
      job: jobData,
      expiresAt: Date.now() + TTL_MS,
    })
  )
}

const route = useRoute()
const { t } = useI18n()

const jobId = computed(() => (route.params.jobId as string) ?? '')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const unlocked = ref(false)
const job = ref<JobShareData | null>(null)

watch(jobId, (id) => {
  if (!id) return
  unlocked.value = false
  job.value = null
  password.value = ''
  error.value = null
  const stored = getStoredAccess(id)
  if (stored.valid && stored.job) {
    unlocked.value = true
    job.value = stored.job
  }
}, { immediate: true })

onMounted(() => {
  if (jobId.value) {
    const stored = getStoredAccess(jobId.value)
    if (stored.valid && stored.job) {
      unlocked.value = true
      job.value = stored.job
    }
  }
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
      setStoredAccess(jobId.value, result.job)
      job.value = result.job
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
            <button
              class="btn btn-primary"
              type="submit"
              :disabled="loading"
            >
              {{ loading ? t('common.loading') + '…' : t('share.submit') }}
            </button>
          </form>
        </div>
      </template>

      <template v-else>
        <JobShareCard
          v-if="job"
          :job="job"
          @copy-link="handleCopyLink"
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
