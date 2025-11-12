<script setup lang="ts">
import { computed, ref } from 'vue'
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
}>()

const { t } = useI18n()
const productionInput = ref<number | null>(null)
const localError = ref<string | null>(null)

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
  localError.value = null
  if (!productionInput.value || productionInput.value <= 0) {
    localError.value = t('common.invalidNumber')
    return
  }

  try {
    emit('production', props.job.id, productionInput.value)
    productionInput.value = null
  } catch (error) {
    console.error(error)
    localError.value = t('errors.updateProduction')
  }
}

function formatHistoryEntry(delta: number, createdAt: string) {
  return t('jobs.history.entry', {
    quantity: delta,
    date: format(new Date(createdAt), 'dd MMM yyyy HH:mm'),
  })
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
        <div>
          <span class="label">{{ t('jobs.partsNeeded') }}</span>
          <strong>{{ job.parts_needed }}</strong>
        </div>
        <div>
          <span class="label">{{ t('jobs.partsProduced') }}</span>
          <strong>{{ job.parts_produced }}</strong>
        </div>
        <div v-if="partsOverproduced > 0" class="overproduced">
          <span class="label">{{ t('jobs.partsOverproduced') }}</span>
          <strong>{{ partsOverproduced }}</strong>
        </div>
        <div>
          <span class="label">{{ t('jobs.partsRemaining') }}</span>
          <strong>{{ partsRemaining }}</strong>
        </div>
      </div>

      <form class="production-form" @submit.prevent="handleProductionSubmit">
        <label :for="`production-${job.id}`">{{ t('jobs.productionDelta') }}</label>
        <input
          :id="`production-${job.id}`"
          v-model.number="productionInput"
          type="number"
          min="1"
          :placeholder="t('jobs.deltaHelp')"
        />
        <p class="help">{{ t('jobs.deltaHelp') }}</p>
        <p v-if="localError" class="error">{{ localError }}</p>
        <button class="btn btn-primary" type="submit">
          {{ t('jobs.updateProduction') }}
        </button>
      </form>
    </section>

    <footer class="job-footer">
      <div class="history">
        <h3>{{ t('jobs.history.title') }}</h3>
        <div v-if="job.job_updates.length === 0" class="history-empty">
          {{ t('jobs.history.empty') }}
        </div>
        <ul v-else>
          <li v-for="update in job.job_updates" :key="update.id">
            {{ formatHistoryEntry(update.delta, update.created_at) }}
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
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.label {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stats strong {
  display: block;
  font-size: 20px;
  margin-top: 6px;
}

.stats .overproduced {
  color: #2563eb;
}

.stats .overproduced .label {
  color: #2563eb;
}

.stats .overproduced strong {
  color: #2563eb;
}

.production-form .help {
  font-size: 12px;
  margin: 4px 0 8px;
  color: #6b7280;
}

.production-form .error {
  color: #dc2626;
  font-size: 12px;
  margin: 0 0 8px;
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

.history li {
  padding: 6px 0;
  border-bottom: 1px solid rgba(107, 114, 128, 0.2);
  font-size: 13px;
}

.history li:last-child {
  border-bottom: none;
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
</style>

