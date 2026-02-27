<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { format } from 'date-fns'
import { useI18n } from 'vue-i18n'

import type { JobWithHistory } from '../../types/job'

const props = defineProps<{
  job: JobWithHistory
}>()

const emit = defineEmits<{
  (e: 'edit', jobId: string): void
  (e: 'archive', jobId: string, archived: boolean): void
  (e: 'delete', jobId: string): void
  (e: 'production', jobId: string, delta: number): void
  (e: 'editHistory', jobId: string, historyId: string, currentDelta: number): void
  (e: 'deleteHistory', jobId: string, historyId: string): void
  (e: 'updateNotes', jobId: string, notes: string | null): void
  (e: 'delivery', jobId: string, delta: number): void
}>()

const { t } = useI18n()
const productionInput = ref<number | null>(null)
const deliveryInput = ref<number | null>(null)
const notesInput = ref<string>('')
const productionError = ref<string | null>(null)
const deliveryError = ref<string | null>(null)

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
  return t('jobs.history.entry', { quantity: delta, date })
}

function handleNotesBlur() {
  const value = notesInput.value.trim()
  const normalized = value === '' ? null : value
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
</script>

<template>
  <article class="job-card card">
    <header class="job-header">
      <div>
        <h2>{{ job.name }}</h2>
        <p class="assignee">
          {{ t('jobs.assignee') }}: {{ job.assignee }}
        </p>
      </div>
      <div class="status">
        <span :class="statusBadgeClass">
          {{ t(`jobs.status.${job.status}`) }}
        </span>
        <span class="date">{{ t('jobs.dateAdded') }}: {{ format(new Date(job.created_at), 'dd MMM yyyy') }}</span>
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
      </div>

      <div class="notes-section">
        <label :for="`notes-${job.id}`" class="notes-label">{{ t('jobs.notes') }}</label>
        <textarea
          :id="`notes-${job.id}`"
          v-model="notesInput"
          :placeholder="t('jobs.notesPlaceholder')"
          :aria-label="t('jobs.notes')"
          class="notes-input"
          rows="2"
          maxlength="2000"
          @blur="handleNotesBlur"
        />
      </div>

      <form class="production-form" @submit.prevent="handleProductionSubmit">
        <div class="production-form-row">
          <input
            :id="`production-${job.id}`"
            v-model.number="productionInput"
            type="number"
            min="1"
            :placeholder="t('jobs.updateProduction')"
            :aria-label="t('jobs.updateProduction')"
            class="production-input"
          />
          <button class="btn btn-primary" type="submit">
            {{ t('jobs.updateProduction') }}
          </button>
        </div>
        <p v-if="productionError" class="error">{{ productionError }}</p>
      </form>

      <form class="delivery-form" @submit.prevent="handleDeliverySubmit">
        <div class="production-form-row">
          <input
            :id="`delivery-${job.id}`"
            v-model.number="deliveryInput"
            type="number"
            min="1"
            :placeholder="t('jobs.addDelivery')"
            :aria-label="t('jobs.addDelivery')"
            class="production-input"
          />
          <button class="btn btn-primary" type="submit">
            {{ t('jobs.addDelivery') }}
          </button>
        </div>
        <p v-if="deliveryError" class="error">{{ deliveryError }}</p>
      </form>
    </section>

    <footer class="job-footer">
      <div class="history">
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
                @click="emit('editHistory', job.id, update.id, update.delta)"
              >
                {{ t('jobs.history.edit') }}
              </button>
              <button
                class="btn-icon btn-icon-danger"
                type="button"
                :title="t('jobs.history.delete')"
                @click="emit('deleteHistory', job.id, update.id)"
              >
                {{ t('jobs.history.delete') }}
              </button>
            </div>
          </li>
        </ul>
      </div>
      <div class="actions">
        <button class="btn btn-secondary" type="button" @click="emit('edit', job.id)">
          {{ t('jobs.editJob') }}
        </button>
        <button
          v-if="job.archived"
          class="btn btn-secondary"
          type="button"
          @click="emit('archive', job.id, false)"
        >
          {{ t('jobs.unarchive') }}
        </button>
        <button
          v-else
          class="btn btn-secondary"
          type="button"
          @click="emit('archive', job.id, true)"
        >
          {{ t('jobs.archive') }}
        </button>
        <button class="btn btn-danger" type="button" @click="emit('delete', job.id)">
          {{ t('jobs.delete') }}
        </button>
      </div>
    </footer>
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
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.job-header h2 {
  margin: 0 0 6px;
  font-size: 20px;
}

.assignee {
  margin: 0;
  color: #4b5563;
  font-size: 14px;
}

.status {
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
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
.delivery-form .error {
  color: #dc2626;
  font-size: 12px;
  margin: 8px 0 0;
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

.job-footer {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-end;
}

@media (max-width: 720px) {
  .job-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .status {
    align-items: flex-start;
  }

  .actions {
    justify-content: flex-start;
  }
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

