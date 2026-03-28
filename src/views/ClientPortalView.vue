<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import { useAuthStore } from '../stores/auth'
import { useClientPortalStore } from '../stores/clientPortal'

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

onMounted(async () => {
  await loadJobs(false)
})

watch(
  () => authStore.clientId,
  async (clientId) => {
    if (clientId) {
      await portalStore.fetchJobs(clientId, showArchived.value)
    }
  }
)
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
      <button class="btn btn-secondary" type="button" @click="toggleArchived">
        {{
          showArchived
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
              <th>{{ t('clients.partsRequested') }}</th>
              <th>{{ t('clients.partsProduced') }}</th>
              <th>{{ t('clients.partsDelivered') }}</th>
              <th>{{ t('clients.progress') }}</th>
              <th>{{ t('clients.stageSummary') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in filteredJobs" :key="job.id">
              <td class="job-name-cell">
                <div class="job-name">{{ job.name }}</div>
                <span class="badge" :class="{ 'badge-success': job.status === 'completed' }">
                  {{ t(`jobs.status.${job.status}`) }}
                </span>
              </td>
              <td>{{ job.parts_needed }}</td>
              <td>{{ job.parts_produced }}</td>
              <td>{{ job.delivered }}</td>
              <td class="progress-cell">
                <div class="progress-copy">
                  {{ productionProgress(job) }}%
                </div>
                <div class="progress-track" aria-hidden="true">
                  <div class="progress-fill" :style="{ width: `${productionProgress(job)}%` }" />
                </div>
              </td>
              <td class="stage-cell">
                <div>{{ t('clients.partsRequested') }}: {{ job.parts_needed }}</div>
                <div>{{ t('clients.partsProduced') }}: {{ job.parts_produced }}</div>
                <div>{{ t('clients.partsDelivered') }}: {{ job.delivered }}</div>
              </td>
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
  align-items: center;
  gap: 12px;
}

.search-input {
  flex: 1;
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

.job-name-cell {
  min-width: 220px;
}

.job-name {
  font-weight: 600;
  margin-bottom: 8px;
}

.progress-cell {
  min-width: 200px;
}

.progress-copy {
  margin-bottom: 8px;
  font-weight: 600;
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

.stage-cell {
  min-width: 220px;
  color: #4b5563;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
