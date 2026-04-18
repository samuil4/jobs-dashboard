<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import { useAuthStore } from '../stores/auth'
import { useClientPortalStore } from '../stores/clientPortal'
import type { ClientJobRecord } from '../types/client'

const authStore = useAuthStore()
const portalStore = useClientPortalStore()
const { t } = useI18n()

const { filteredJobs, loading, error, searchTerm, showArchived } = storeToRefs(portalStore)

const companyName = computed(() => authStore.clientCompanyName ?? t('clients.portalTitle'))

async function loadJobs(includeArchived = false) {
  if (!authStore.clientId) return
  await portalStore.fetchJobs(authStore.clientId, includeArchived)
}

async function toggleArchived() {
  if (!authStore.clientId) return
  await portalStore.toggleArchived(authStore.clientId)
}

function productionProgress(job: {
  parts_needed: number
  parts_produced: number
}) {
  if (!job.parts_needed) return 0
  return Math.min(100, Math.round((job.parts_produced / job.parts_needed) * 100))
}

function totalProduced(job: {
  parts_produced: number
  parts_overproduced: number
}) {
  return job.parts_produced + (job.parts_overproduced ?? 0)
}

function readyForPickup(job: ClientJobRecord) {
  return Math.max(0, totalProduced(job) - (job.delivered ?? 0))
}

function displayPurchaseOrder(job: ClientJobRecord) {
  const s = job.purchase_order?.trim()
  return s ? s : null
}

function displayInvoice(job: ClientJobRecord) {
  const s = job.invoice?.trim()
  return s ? s : null
}

function rowStatusClass(job: ClientJobRecord) {
  if (job.status === 'archived') return 'job-row-archived'
  if (job.status === 'completed') return 'job-row-completed'
  return 'job-row-active'
}

onMounted(async () => {
  await loadJobs(false)
  if (authStore.clientId) {
    portalStore.subscribe(authStore.clientId)
  }
})

watch(
  () => authStore.clientId,
  async (clientId, previousClientId) => {
    if (previousClientId && previousClientId !== clientId) {
      portalStore.unsubscribe()
    }
    if (clientId) {
      await portalStore.fetchJobs(clientId, showArchived.value)
      portalStore.subscribe(clientId)
    }
  }
)

onUnmounted(() => {
  portalStore.unsubscribe()
})
</script>

<template>
  <section class="client-portal">
    <div class="page-header">
      <div>
        <h1>{{ companyName }}</h1>
        <p class="page-subtitle">{{ t('clients.portalSubtitle') }}</p>
      </div>
    </div>

    <div class="toolbar card">
      <input
        v-model="searchTerm"
        type="search"
        class="search-input"
        :placeholder="t('clients.searchPlaceholder')"
      />
      <button
        class="btn btn-secondary"
        :class="{ 'is-loading': loading }"
        type="button"
        :disabled="loading"
        @click="toggleArchived"
      >
        {{
          loading
            ? t('common.loading') + '…'
            : showArchived
            ? t('clients.hideArchived')
            : t('clients.showArchived')
        }}
      </button>
    </div>

    <div v-if="loading" class="card state">
      {{ t('common.loading') }}…
    </div>

    <div v-else-if="error" class="card state error">
      {{ t('errors.loadClientJobs') }}
    </div>

    <div v-else-if="filteredJobs.length === 0" class="card state">
      {{ t('clients.portalEmpty') }}
    </div>

    <div v-else class="card table-card">
      <div class="table-wrap">
        <table class="jobs-table">
          <thead>
            <tr>
              <th>{{ t('jobs.jobName') }}</th>
              <th>{{ t('clients.requested') }}</th>
              <th>{{ t('clients.produced') }}</th>
              <th>{{ t('clients.delivered') }}</th>
              <th>{{ t('clients.readyForPickup') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in filteredJobs" :key="job.id" class="job-row">
              <td class="job-name-cell" :class="rowStatusClass(job)">
                <div class="job-name-block">
                  <div class="job-name-line">
                    <template v-if="displayPurchaseOrder(job)">
                      <span class="po-before-name">PO: {{ displayPurchaseOrder(job) }}</span>
                      {{ ' ' }}
                    </template>
                    <span class="job-name">{{ job.name }}</span>
                  </div>
                  <div class="job-name-meta">
                    <span
                      class="badge"
                      :class="{
                        'badge-success': job.status === 'completed',
                        'badge-info': job.status === 'active',
                        'badge-muted': job.status === 'archived',
                      }"
                    >
                      {{ t(`jobs.status.${job.status}`) }}
                    </span>
                    <span v-if="displayInvoice(job)" class="invoice-meta">
                      {{ t('jobs.invoice') }}: {{ displayInvoice(job) }}
                    </span>
                    <span
                      class="badge"
                      :class="{
                        'badge-info': (job.priority ?? 'normal') === 'normal',
                        'badge-warning': job.priority === 'high',
                        'badge-danger': job.priority === 'urgent',
                      }"
                    >
                      {{ t(`jobs.priority.${job.priority ?? 'normal'}`) }}
                    </span>
                  </div>
                  <div class="progress-under-name">
                    <div class="progress-copy">
                      {{ productionProgress(job) }}%
                    </div>
                    <div class="progress-track" aria-hidden="true">
                      <div class="progress-fill" :style="{ width: `${productionProgress(job)}%` }" />
                    </div>
                  </div>
                </div>
              </td>
              <td>{{ job.parts_needed }}</td>
              <td>{{ totalProduced(job) }}</td>
              <td>{{ job.delivered }}</td>
              <td>{{ readyForPickup(job) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.client-portal {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header h1 {
  margin: 0;
  font-size: 28px;
}

.page-subtitle {
  margin: 6px 0 0;
  color: #6b7280;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.search-input {
  flex: 1;
  min-width: 160px;
  margin: 0;
}

.state {
  text-align: center;
  padding: 32px;
  font-size: 16px;
}

.state.error {
  color: #dc2626;
}

.table-card {
  padding: 0;
  overflow: hidden;
}

.table-wrap {
  overflow-x: auto;
}

.jobs-table {
  width: 100%;
  border-collapse: collapse;
}

.jobs-table th,
.jobs-table td {
  padding: 16px 20px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: top;
}

.jobs-table th {
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6b7280;
  background: #f9fafb;
  white-space: nowrap;
}

.job-name-cell.job-row-active {
  box-shadow: inset 4px 0 0 0 #2563eb;
}

.job-name-cell.job-row-completed {
  box-shadow: inset 4px 0 0 0 #16a34a;
}

.job-name-cell.job-row-archived {
  box-shadow: inset 4px 0 0 0 #9ca3af;
}

.job-name-cell {
  min-width: 280px;
}

.job-name-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.job-name-line {
  font-weight: 600;
  font-size: 15px;
  color: #111827;
  line-height: 1.35;
}

.po-before-name {
  font-weight: 600;
  color: #374151;
}

.job-name {
  font-weight: 600;
}

.job-name-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.invoice-meta {
  font-size: 13px;
  color: #4b5563;
  line-height: 1.3;
}

.badge-muted {
  background: #f3f4f6;
  color: #4b5563;
}

.progress-under-name {
  width: 100%;
  max-width: 320px;
}

.progress-copy {
  margin-bottom: 6px;
  font-weight: 600;
  font-size: 13px;
  color: #374151;
}

.progress-track {
  height: 10px;
  background: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #2563eb;
  border-radius: 999px;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
