<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { format } from 'date-fns'
import { useI18n } from 'vue-i18n'

import { useToastStore } from '../../stores/toast'
import type { JobWithHistory, UpdateType } from '../../types/job'

const router = useRouter()

const props = defineProps<{
  job: JobWithHistory
  variant?: 'default' | 'completed'
  isBusy?: boolean
  isNotesSaving?: boolean
  isProductionSubmitting?: boolean
  isDeliverySubmitting?: boolean
  isFailedProductionSubmitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'edit', jobId: string): void
  (e: 'archive', jobId: string, archived: boolean): void
  (e: 'delete', jobId: string): void
  (e: 'production', jobId: string, delta: number): void
  (e: 'editHistory', jobId: string, historyId: string, currentDelta: number, updateType?: UpdateType): void
  (e: 'deleteHistory', jobId: string, historyId: string): void
  (e: 'updateNotes', jobId: string, notes: string | null): void
  (
    e: 'delivery',
    jobId: string,
    delta: number,
    callbacks?: { onSuccess: () => void; onError: (message: string) => void },
  ): void
  (
    e: 'addFailedProduction',
    jobId: string,
    delta: number,
    callbacks?: { onSuccess: () => void; onError: (message: string) => void }
  ): void
}>()

const { t } = useI18n()
const toastStore = useToastStore()
const productionInput = ref<number | null>(null)
const deliveryInput = ref<number | null>(null)
const failedProductionInput = ref<number | null>(null)
const notesInput = ref<string>('')
const productionError = ref<string | null>(null)
const deliveryError = ref<string | null>(null)
const failedProductionError = ref<string | null>(null)
const menuOpen = ref(false)
const menuAnchorRef = ref<HTMLElement | null>(null)
const failedProductionModalOpen = ref(false)
const deliveryModalOpen = ref(false)

watch(
  () => props.job.notes,
  (val) => { notesInput.value = val ?? '' },
  { immediate: true }
)

const totalProduced = computed(
  () => (props.job.parts_produced ?? 0) + (props.job.parts_overproduced ?? 0)
)

const partsRemaining = computed(() =>
  Math.max(props.job.parts_needed - props.job.parts_produced, 0)
)

const partsOverproduced = computed(() => props.job.parts_overproduced ?? 0)

/** No remaining capacity to record delivery (same rule as handleDeliverySubmit). */
const canAddMoreDelivery = computed(() => {
  const delivered = props.job.delivered ?? 0
  return delivered < totalProduced.value
})

const statusBadgeClass = computed(() => {
  switch (props.job.status) {
    case 'completed':
      return 'badge badge-success'
    case 'archived':
      return 'badge'
    default:
      return 'badge badge-warning'
  }
})

const effectivePriority = computed(() => props.job.priority ?? 'normal')

const priorityBadgeClass = computed(() => {
  switch (effectivePriority.value) {
    case 'low':
      return 'badge'
    case 'high':
      return 'badge badge-warning'
    case 'urgent':
      return 'badge badge-danger'
    default:
      return 'badge badge-info'
  }
})

async function handleProductionSubmit() {
  productionError.value = null
  if (!productionInput.value || productionInput.value <= 0) {
    productionError.value = t('common.invalidNumber')
    return
  }

  try {
    emit('production', props.job.id, productionInput.value)
    productionInput.value = null
  } catch (error) {
    console.error(error)
    productionError.value = t('errors.updateProduction')
  }
}

function formatHistoryEntry(delta: number, createdAt: string, updateType?: string) {
  const date = format(new Date(createdAt), 'dd MMM yyyy HH:mm')
  if (updateType === 'delivery') {
    return t('jobs.history.entryDelivered', { quantity: delta, date })
  }
  if (updateType === 'failed_production') {
    return t('jobs.history.entryFailed', { quantity: delta, date })
  }
  return t('jobs.history.entry', { quantity: delta, date })
}

function handleNotesBlur() {
  const value = notesInput.value.trim()
  const normalized = value === '' ? null : value
  if (normalized === (props.job.notes ?? null)) return
  emit('updateNotes', props.job.id, normalized)
}

async function handleDeliverySubmit() {
  deliveryError.value = null
  if (!deliveryInput.value || deliveryInput.value <= 0) {
    deliveryError.value = t('common.invalidNumber')
    return
  }
  const delivered = props.job.delivered ?? 0
  if (deliveryInput.value + delivered > totalProduced.value) {
    deliveryError.value = t('errors.deliveredExceedsProduced')
    return
  }
  try {
    emit('delivery', props.job.id, deliveryInput.value)
    deliveryInput.value = null
  } catch (error) {
    console.error(error)
    deliveryError.value = t('errors.updateProduction')
  }
}

const canShare = computed(() => Boolean(props.job.has_share_password))
const shareLinkCopied = ref(false)

const totalFailed = computed(() => props.job.parts_failed ?? 0)
const failedPercent = computed(() => {
  const totalProduction = totalProduced.value
  const failed = totalFailed.value
  const total = totalProduction + failed
  return total > 0 ? (100 * failed / total).toFixed(2) : '0.00'
})

function copyShareLink() {
  if (canShare.value) {
    menuOpen.value = false
    const url = `${window.location.origin}${router.resolve({ name: 'jobShare', params: { jobId: props.job.id } }).href}`
    navigator.clipboard
      .writeText(url)
      .then(() => {
        shareLinkCopied.value = true
        setTimeout(() => { shareLinkCopied.value = false }, 2000)
      })
      .catch(() => {
        toastStore.show(t('jobs.copyShareLinkFailed'))
      })
    return
  }
  menuOpen.value = false
  toastStore.show(t('jobs.setPasswordToShareHint'))
}

function handleEditClick() {
  menuOpen.value = false
  emit('edit', props.job.id)
}

function handleArchiveClick(archived: boolean) {
  menuOpen.value = false
  emit('archive', props.job.id, archived)
}

function handleDeleteClick() {
  menuOpen.value = false
  emit('delete', props.job.id)
}

function openFailedProductionModal() {
  menuOpen.value = false
  failedProductionModalOpen.value = true
  failedProductionError.value = null
  failedProductionInput.value = null
}

function closeFailedProductionModal() {
  failedProductionModalOpen.value = false
  failedProductionError.value = null
  failedProductionInput.value = null
}

function openDeliveryModal() {
  menuOpen.value = false
  deliveryModalOpen.value = true
  deliveryError.value = null
  deliveryInput.value = null
}

function closeDeliveryModal() {
  deliveryModalOpen.value = false
  deliveryError.value = null
  deliveryInput.value = null
}

function handleDeliveryModalSubmit() {
  deliveryError.value = null
  if (!deliveryInput.value || deliveryInput.value <= 0) {
    deliveryError.value = t('common.invalidNumber')
    return
  }
  const delivered = props.job.delivered ?? 0
  if (deliveryInput.value + delivered > totalProduced.value) {
    deliveryError.value = t('errors.deliveredExceedsProduced')
    return
  }
  emit('delivery', props.job.id, deliveryInput.value, {
    onSuccess: () => closeDeliveryModal(),
    onError: (message: string) => {
      deliveryError.value = message
    },
  })
}

function handleFailedProductionSubmit() {
  failedProductionError.value = null
  if (!failedProductionInput.value || failedProductionInput.value <= 0) {
    failedProductionError.value = t('common.invalidNumber')
    return
  }
  emit('addFailedProduction', props.job.id, failedProductionInput.value, {
    onSuccess: () => closeFailedProductionModal(),
    onError: (message: string) => {
      failedProductionError.value = message
    },
  })
}

function onClickOutsideMenu(event: MouseEvent) {
  const target = event.target as Node
  if (menuOpen.value && menuAnchorRef.value && !menuAnchorRef.value.contains(target)) {
    menuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutsideMenu as EventListener)
})
onUnmounted(() => {
  document.removeEventListener('click', onClickOutsideMenu as EventListener)
})
</script>

<template>
  <article class="job-card card" :class="{ 'is-compact': variant === 'completed' }">
    <header class="job-header">
      <div class="job-header-title-row">
        <h2>{{ job.name }}</h2>
      </div>
      <div class="job-header-meta-row">
        <span class="assignee">{{ t('jobs.assignee') }}: {{ job.assignee }}</span>
        <span v-if="job.client" class="assignee">{{ t('jobs.client') }}: {{ job.client.company_name }}</span>
        <span :class="statusBadgeClass">{{ t(`jobs.status.${job.status}`) }}</span>
        <span :class="priorityBadgeClass">{{ t(`jobs.priority.${effectivePriority}`) }}</span>
        <span class="date">{{ t('jobs.dateAdded') }}: {{ format(new Date(job.created_at), 'dd MMM yyyy') }}</span>
        <div ref="menuAnchorRef" class="menu-wrapper">
          <button
            type="button"
            class="btn-menu-trigger"
            :aria-label="t('jobs.cardMenu')"
            :aria-expanded="menuOpen"
            :disabled="isBusy"
            @click.stop="menuOpen = !menuOpen"
          >
            <svg class="dots-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
          <div v-if="menuOpen" class="menu-dropdown" role="menu" @click.stop>
            <button
              type="button"
              role="menuitem"
              class="menu-item"
              :disabled="isBusy"
              @click="handleEditClick"
            >
              <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              {{ t('jobs.editJob') }}
            </button>
            <button
              v-if="job.archived"
              type="button"
              role="menuitem"
              class="menu-item"
              :disabled="isBusy"
              @click="handleArchiveClick(false)"
            >
              <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" />
                <path d="M1 3h22v5H1z" />
                <path d="M10 12l2-2 2 2" />
                <path d="M12 10v6" />
              </svg>
              {{ t('jobs.unarchive') }}
            </button>
            <button
              v-else
              type="button"
              role="menuitem"
              class="menu-item"
              :disabled="isBusy"
              @click="handleArchiveClick(true)"
            >
              <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" />
                <path d="M1 3h22v5H1z" />
                <path d="M10 12l2 2 2-2" />
                <path d="M12 10v6" />
              </svg>
              {{ t('jobs.archive') }}
            </button>
            <button
              type="button"
              role="menuitem"
              class="menu-item"
              :disabled="isBusy"
              @click="copyShareLink"
            >
              <svg class="share-icon menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              {{ shareLinkCopied ? t('jobs.shareLinkCopied') : t('jobs.copyShareLink') }}
            </button>
            <button
              v-if="variant === 'completed' && canAddMoreDelivery"
              type="button"
              role="menuitem"
              class="menu-item"
              :disabled="isBusy"
              @click="openDeliveryModal"
            >
              <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M16.5 9.4l-9-5.19" />
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              {{ t('jobs.addDelivery') }}
            </button>
            <button
              type="button"
              role="menuitem"
              class="menu-item menu-item-fail"
              :disabled="isBusy"
              @click="openFailedProductionModal"
            >
              <svg class="menu-icon fail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              {{ t('jobs.addFailedProduction') }}
            </button>
            <button
              type="button"
              role="menuitem"
              class="menu-item menu-item-danger"
              :disabled="isBusy"
              @click="handleDeleteClick"
            >
              <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
              {{ t('jobs.delete') }}
            </button>
          </div>
        </div>
      </div>
    </header>

    <section class="job-body">
      <div class="stats">
        <div class="stat-item">
          <span class="label">{{ t('jobs.partsNeeded') }}:</span>
          <strong>{{ job.parts_needed }}</strong>
        </div>
        <div class="stat-item">
          <span class="label">{{ t('jobs.partsProduced') }}:</span>
          <strong>{{ job.parts_produced }}</strong>
        </div>
        <div class="stat-item">
          <span class="label">{{ t('jobs.partsRemaining') }}:</span>
          <strong>{{ partsRemaining }}</strong>
        </div>
        <div v-if="partsOverproduced > 0" class="stat-item overproduced">
          <span class="label">{{ t('jobs.partsOverproduced') }}:</span>
          <strong>{{ partsOverproduced }}</strong>
        </div>
        <div class="stat-item">
          <span class="label">{{ t('jobs.delivered') }}:</span>
          <strong>{{ job.delivered ?? 0 }}</strong>
        </div>
        <div class="stat-item stat-item-failed">
          <span class="label">{{ t('jobs.failed') }}:</span>
          <strong>{{ totalFailed }} ({{ failedPercent }}%)</strong>
        </div>
      </div>

      <div v-if="variant === 'completed' && job.notes" class="notes-section">
        <span class="notes-label">{{ t('jobs.notes') }}</span>
        <p class="notes-text">{{ job.notes }}</p>
      </div>

      <div v-if="variant !== 'completed'" class="notes-section">
        <label :for="`notes-${job.id}`" class="notes-label">{{ t('jobs.notes') }}</label>
        <textarea
          :id="`notes-${job.id}`"
          v-model="notesInput"
          :placeholder="t('jobs.notesPlaceholder')"
          :aria-label="t('jobs.notes')"
          class="notes-input"
          rows="2"
          maxlength="2000"
          :disabled="isNotesSaving"
          @blur="handleNotesBlur"
        />
        <p v-if="isNotesSaving" class="pending-hint">{{ t('common.saving') }}</p>
      </div>

      <form v-if="variant !== 'completed'" class="production-form" @submit.prevent="handleProductionSubmit">
        <div class="production-form-row">
          <input
            :id="`production-${job.id}`"
            v-model.number="productionInput"
            type="number"
            min="1"
            :placeholder="t('jobs.updateProduction')"
            :aria-label="t('jobs.updateProduction')"
            class="production-input"
            :disabled="isProductionSubmitting"
          />
          <button
            class="btn btn-primary"
            :class="{ 'is-loading': isProductionSubmitting }"
            type="submit"
            :disabled="isProductionSubmitting"
          >
            {{ isProductionSubmitting ? t('common.saving') : t('jobs.updateProduction') }}
          </button>
        </div>
        <p v-if="productionError" class="error">{{ productionError }}</p>
      </form>

      <form v-if="variant !== 'completed'" class="delivery-form" @submit.prevent="handleDeliverySubmit">
        <div class="production-form-row">
          <input
            :id="`delivery-${job.id}`"
            v-model.number="deliveryInput"
            type="number"
            min="1"
            :placeholder="t('jobs.addDelivery')"
            :aria-label="t('jobs.addDelivery')"
            class="production-input"
            :disabled="isDeliverySubmitting"
          />
          <button
            class="btn btn-primary"
            :class="{ 'is-loading': isDeliverySubmitting }"
            type="submit"
            :disabled="isDeliverySubmitting"
          >
            {{ isDeliverySubmitting ? t('common.saving') : t('jobs.addDelivery') }}
          </button>
        </div>
        <p v-if="deliveryError" class="error">{{ deliveryError }}</p>
      </form>
    </section>

    <footer class="job-footer">
      <details v-if="variant === 'completed'" class="history history-collapsible">
        <summary class="history-toggle">
          {{ t('jobs.history.title') }}
          <span class="history-count">({{ job.job_updates.length }})</span>
        </summary>
        <div v-if="job.job_updates.length === 0" class="history-empty">
          {{ t('jobs.history.empty') }}
        </div>
        <ul v-else>
          <li v-for="update in job.job_updates" :key="update.id" class="history-item">
            <span class="history-entry">{{ formatHistoryEntry(update.delta, update.created_at, update.update_type) }}</span>
            <div class="history-actions">
              <button
                class="btn-icon"
                type="button"
                :title="t('jobs.history.edit')"
                :disabled="isBusy"
                @click="emit('editHistory', job.id, update.id, update.delta, update.update_type)"
              >
                {{ t('jobs.history.edit') }}
              </button>
              <button
                class="btn-icon btn-icon-danger"
                type="button"
                :title="t('jobs.history.delete')"
                :disabled="isBusy"
                @click="emit('deleteHistory', job.id, update.id)"
              >
                {{ t('jobs.history.delete') }}
              </button>
            </div>
          </li>
        </ul>
      </details>

      <div v-else class="history">
        <h3>{{ t('jobs.history.title') }}</h3>
        <div v-if="job.job_updates.length === 0" class="history-empty">
          {{ t('jobs.history.empty') }}
        </div>
        <ul v-else>
          <li v-for="update in job.job_updates" :key="update.id" class="history-item">
            <span class="history-entry">{{ formatHistoryEntry(update.delta, update.created_at, update.update_type) }}</span>
            <div class="history-actions">
              <button
                class="btn-icon"
                type="button"
                :title="t('jobs.history.edit')"
                :disabled="isBusy"
                @click="emit('editHistory', job.id, update.id, update.delta, update.update_type)"
              >
                {{ t('jobs.history.edit') }}
              </button>
              <button
                class="btn-icon btn-icon-danger"
                type="button"
                :title="t('jobs.history.delete')"
                :disabled="isBusy"
                @click="emit('deleteHistory', job.id, update.id)"
              >
                {{ t('jobs.history.delete') }}
              </button>
            </div>
          </li>
        </ul>
      </div>
    </footer>

    <div v-if="failedProductionModalOpen" class="overlay" role="dialog" aria-modal="true" :aria-labelledby="`failed-modal-title-${job.id}`">
      <div class="modal failed-production-modal">
        <header class="modal-header">
          <h2 :id="`failed-modal-title-${job.id}`">{{ t('jobs.failedProductionModalTitle') }}</h2>
          <button
            class="btn btn-ghost"
            type="button"
            :aria-label="t('common.close')"
            :disabled="isFailedProductionSubmitting"
            @click="closeFailedProductionModal"
          >
            {{ t('common.close') }}
          </button>
        </header>
        <form class="modal-form" @submit.prevent="handleFailedProductionSubmit">
          <div class="production-form-row">
            <input
              :id="`failed-production-${job.id}`"
              v-model.number="failedProductionInput"
              type="number"
              min="1"
              :placeholder="t('jobs.addFailedProduction')"
              :aria-label="t('jobs.addFailedProduction')"
              class="production-input"
              :disabled="isFailedProductionSubmitting"
            />
            <button
              class="btn btn-primary"
              :class="{ 'is-loading': isFailedProductionSubmitting }"
              type="submit"
              :disabled="isFailedProductionSubmitting"
            >
              {{ isFailedProductionSubmitting ? t('common.saving') : t('jobs.addFailedProduction') }}
            </button>
          </div>
          <p v-if="failedProductionError" class="error">{{ failedProductionError }}</p>
        </form>
      </div>
    </div>

    <div v-if="deliveryModalOpen" class="overlay" role="dialog" aria-modal="true" :aria-labelledby="`delivery-modal-title-${job.id}`">
      <div class="modal failed-production-modal">
        <header class="modal-header">
          <h2 :id="`delivery-modal-title-${job.id}`">{{ t('jobs.deliveryModalTitle') }}</h2>
          <button
            class="btn btn-ghost"
            type="button"
            :aria-label="t('common.close')"
            :disabled="isDeliverySubmitting"
            @click="closeDeliveryModal"
          >
            {{ t('common.close') }}
          </button>
        </header>
        <form class="modal-form" @submit.prevent="handleDeliveryModalSubmit">
          <div class="production-form-row">
            <input
              :id="`delivery-modal-${job.id}`"
              v-model.number="deliveryInput"
              type="number"
              min="1"
              :placeholder="t('jobs.addDelivery')"
              :aria-label="t('jobs.addDelivery')"
              class="production-input"
              :disabled="isDeliverySubmitting"
            />
            <button
              class="btn btn-primary"
              :class="{ 'is-loading': isDeliverySubmitting }"
              type="submit"
              :disabled="isDeliverySubmitting"
            >
              {{ isDeliverySubmitting ? t('common.saving') : t('jobs.addDelivery') }}
            </button>
          </div>
          <p v-if="deliveryError" class="error">{{ deliveryError }}</p>
        </form>
      </div>
    </div>
  </article>
</template>

<style scoped>
.job-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.job-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.job-header-title-row h2 {
  margin: 0;
  font-size: 20px;
}

.job-header-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.assignee {
  margin: 0;
  color: #4b5563;
  font-size: 14px;
}

.menu-wrapper {
  position: relative;
}

.btn-menu-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #4b5563;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.btn-menu-trigger:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
  color: #1f2937;
}

.dots-icon {
  width: 20px;
  height: 20px;
}

.menu-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 180px;
  padding: 6px 0;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 20;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: none;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s;
}

.menu-item:hover {
  background: #f3f4f6;
}

.menu-item:disabled {
  opacity: 0.6;
  cursor: wait;
  background: transparent;
}

.menu-item-fail {
  color: #dc2626;
}

.menu-item-fail .fail-icon {
  color: #dc2626;
}

.menu-item-danger {
  color: #dc2626;
}

.menu-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.fail-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.share-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.date {
  font-size: 12px;
  color: #6b7280;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 0;
  border-bottom: 1px solid #e5e7eb;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.stat-item .label {
  font-size: 13px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 500;
}

.stat-item strong {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.stat-item.overproduced {
  color: #2563eb;
}

.stat-item.overproduced .label {
  color: #2563eb;
}

.stat-item.overproduced strong {
  color: #2563eb;
}

.stat-item-failed .label,
.stat-item-failed strong {
  color: #dc2626;
}

.notes-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.notes-label {
  font-size: 13px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 500;
}

.notes-input {
  width: 100%;
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  resize: vertical;
  min-height: 56px;
}

.notes-input:focus {
  outline: none;
  border-color: #2563eb;
}

.pending-hint {
  font-size: 12px;
  color: #2563eb;
  margin: 6px 0 0;
}

.production-form,
.delivery-form {
  margin-top: 12px;
}

.production-form-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.production-input {
  flex: 1;
  min-width: 100px;
  height: 36px;
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  margin: 0;
  width: auto;
}

.production-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.production-form .error,
.delivery-form .error,
.modal-form .error {
  color: #dc2626;
  font-size: 12px;
  margin: 8px 0 0;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.failed-production-modal {
  background: #fff;
  border-radius: 12px;
  padding: 0;
  min-width: 320px;
  max-width: 90vw;
}

.failed-production-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.failed-production-modal .modal-header h2 {
  margin: 0;
  font-size: 18px;
}

.failed-production-modal .modal-form {
  padding: 20px;
}

.history {
  flex: 1;
}

.history h3 {
  margin: 0 0 10px;
  font-size: 16px;
}

.history ul {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 140px;
  overflow-y: auto;
  background: #f3f4f6;
  border-radius: 12px;
  padding: 12px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(107, 114, 128, 0.2);
  font-size: 13px;
}

.history-item:last-child {
  border-bottom: none;
}

.history-entry {
  flex: 1;
}

.history-actions {
  display: flex;
  gap: 6px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.history-item:hover .history-actions {
  opacity: 1;
}

@media (max-width: 640px) {
  .history-actions {
    opacity: 1;
  }
}

.btn-icon {
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.btn-icon:disabled {
  opacity: 0.6;
  cursor: wait;
}

.btn-icon-danger {
  color: #dc2626;
  border-color: #fca5a5;
}

.btn-icon-danger:hover {
  background: #fee2e2;
  border-color: #dc2626;
}

.history-empty {
  font-size: 13px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 12px;
  border-radius: 12px;
}

.history-collapsible {
  border: none;
  padding: 0;
}

.history-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  padding: 6px 0;
  user-select: none;
  list-style: none;
}

.history-toggle::-webkit-details-marker {
  display: none;
}

.history-toggle::before {
  content: '▶';
  font-size: 10px;
  color: #9ca3af;
  transition: transform 0.18s;
  display: inline-block;
}

details[open] .history-toggle::before {
  transform: rotate(90deg);
}

.history-count {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 400;
}

.history-collapsible ul {
  margin-top: 6px;
}

.notes-text {
  margin: 0;
  font-size: 13px;
  color: #374151;
  white-space: pre-wrap;
  line-height: 1.5;
}

.is-compact {
  gap: 12px;
  padding: 16px;
}

.is-compact .job-header-title-row h2 {
  font-size: 16px;
  margin-bottom: 4px;
}

.is-compact .stats {
  gap: 10px 16px;
  margin-bottom: 10px;
  padding: 8px 0;
}

.is-compact .stat-item .label {
  font-size: 12px;
}

.is-compact .stat-item strong {
  font-size: 14px;
}

.job-footer {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

@media (max-width: 640px) {
  .stats {
    gap: 12px 16px;
  }

  .stat-item {
    font-size: 12px;
  }

  .stat-item .label {
    font-size: 12px;
  }

  .stat-item strong {
    font-size: 14px;
  }

  .production-form-row {
    flex-direction: column;
    align-items: stretch;
  }

  .production-input {
    width: 100%;
  }
}
</style>

