<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import ConfirmModal from '../components/ConfirmModal.vue'
import JobCard from '../components/dashboard/JobCard.vue'
import JobFormModal from '../components/dashboard/JobFormModal.vue'
import { useAuthStore } from '../stores/auth'
import { useJobsStore } from '../stores/jobs'
import type { Assignee } from '../types/job'

const jobsStore = useJobsStore()
const authStore = useAuthStore()
const { t } = useI18n()

const { filteredJobs, loading, error, showArchived, statusFilter, searchTerm } =
  storeToRefs(jobsStore)

const showModal = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const editingJobId = ref<string | null>(null)
const deleteModal = reactive({
  show: false,
  jobId: null as string | null,
  jobName: '',
})
const archiveModal = reactive({
  show: false,
  jobId: null as string | null,
  jobName: '',
  action: 'archive' as 'archive' | 'unarchive',
})

const modalInitialValues = computed(() => {
  if (!editingJobId.value) return undefined
  const job = jobsStore.jobs.find((item) => item.id === editingJobId.value)
  if (!job) return undefined
  return {
    name: job.name,
    partsNeeded: job.parts_needed,
    assignee: job.assignee as Assignee,
  }
})

onMounted(async () => {
  await jobsStore.fetchJobs()
})

function openCreateModal() {
  modalMode.value = 'create'
  editingJobId.value = null
  showModal.value = true
}

function openEditModal(jobId: string) {
  modalMode.value = 'edit'
  editingJobId.value = jobId
  showModal.value = true
}

async function handleModalSubmit(payload: { name: string; partsNeeded: number; assignee: Assignee }) {
  try {
    if (modalMode.value === 'create') {
      await jobsStore.createJob(payload)
    } else if (editingJobId.value) {
      await jobsStore.updateJob(editingJobId.value, payload)
    }
    showModal.value = false
  } catch (err) {
    console.error(err)
    alert(t(modalMode.value === 'create' ? 'errors.createJob' : 'errors.updateJob'))
  }
}

function handleArchive(jobId: string, archive: boolean) {
  const job = jobsStore.jobs.find((item) => item.id === jobId)
  if (!job) return
  archiveModal.jobId = jobId
  archiveModal.jobName = job.name
  archiveModal.action = archive ? 'archive' : 'unarchive'
  archiveModal.show = true
}

function closeArchiveModal() {
  archiveModal.show = false
  archiveModal.jobId = null
  archiveModal.jobName = ''
}

async function confirmArchive() {
  if (!archiveModal.jobId) return
  const shouldArchive = archiveModal.action === 'archive'
  try {
    await jobsStore.archiveJob(archiveModal.jobId, shouldArchive)
    closeArchiveModal()
  } catch (err) {
    console.error(err)
    alert(t('errors.updateJob'))
  }
}

function handleDelete(jobId: string) {
  const job = jobsStore.jobs.find((item) => item.id === jobId)
  if (!job) return
  deleteModal.jobId = jobId
  deleteModal.jobName = job.name
  deleteModal.show = true
}

function closeDeleteModal() {
  deleteModal.show = false
  deleteModal.jobId = null
  deleteModal.jobName = ''
}

async function confirmDelete() {
  if (!deleteModal.jobId) return
  try {
    await jobsStore.deleteJob(deleteModal.jobId)
    closeDeleteModal()
  } catch (err) {
    console.error(err)
    alert(t('errors.deleteJob'))
  }
}

async function handleProduction(jobId: string, delta: number) {
  try {
    await jobsStore.addProduction(jobId, delta, authStore.userId)
  } catch (err) {
    console.error(err)
    alert(t('errors.updateProduction'))
  }
}

const archivedToggleLabel = computed(() =>
  showArchived.value ? t('jobs.filter.hideArchived') : t('jobs.filter.showArchived')
)

const archiveModalTitle = computed(() =>
  archiveModal.action === 'archive'
    ? t('jobs.archiveModal.archiveTitle')
    : t('jobs.archiveModal.unarchiveTitle')
)

const archiveModalMessage = computed(() =>
  archiveModal.action === 'archive'
    ? t('jobs.archiveModal.archiveMessage', { name: archiveModal.jobName })
    : t('jobs.archiveModal.unarchiveMessage', { name: archiveModal.jobName })
)

const archiveConfirmLabel = computed(() =>
  archiveModal.action === 'archive' ? t('jobs.archive') : t('jobs.unarchive')
)
</script>

<template>
  <section class="dashboard">
    <header class="dashboard-header">
      <div>
        <h1>{{ t('jobs.heading') }}</h1>
        <p class="subtitle">
          {{ t('navigation.dashboard') }}
        </p>
      </div>
      <button class="btn btn-primary" type="button" @click="openCreateModal">
        {{ t('jobs.addJob') }}
      </button>
    </header>

    <div class="filters card">
      <div class="filter-group">
        <label for="search">{{ t('jobs.filter.search') }}</label>
        <input id="search" v-model="searchTerm" type="search" :placeholder="t('jobs.filter.search')" />
      </div>
      <div class="filter-group">
        <label for="status-filter">{{ t('jobs.filter.status') }}</label>
        <select id="status-filter" v-model="statusFilter">
          <option value="all">{{ t('jobs.filter.all') }}</option>
          <option value="active">{{ t('jobs.filter.active') }}</option>
          <option value="completed">{{ t('jobs.filter.completed') }}</option>
          <option value="archived">{{ t('jobs.filter.archived') }}</option>
        </select>
      </div>
      <div class="filter-group toggle">
        <label>{{ t('navigation.archived') }}</label>
        <button class="btn btn-secondary" type="button" @click="jobsStore.toggleArchivedVisibility">
          {{ archivedToggleLabel }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="card state">
      {{ t('common.loading') }}…
    </div>

    <div v-else-if="error" class="card state error">
      {{ t('errors.loadJobs') }}
    </div>

    <div v-else-if="filteredJobs.length === 0" class="card state">
      {{ t('jobs.empty') }}
    </div>

    <div v-else class="jobs-grid">
      <JobCard
        v-for="job in filteredJobs"
        :key="job.id"
        :job="job"
        @edit="openEditModal"
        @archive="handleArchive"
        @delete="handleDelete"
        @production="handleProduction"
      />
    </div>

    <JobFormModal
      :show="showModal"
      :mode="modalMode"
      :initial-values="modalInitialValues"
      @close="showModal = false"
      @submit="handleModalSubmit"
    />

    <ConfirmModal
      :show="deleteModal.show"
      :title="t('jobs.deleteModal.title')"
      :description="t('jobs.deleteModal.message', { name: deleteModal.jobName })"
      :confirm-label="t('jobs.delete')"
      confirm-variant="danger"
      @cancel="closeDeleteModal"
      @confirm="confirmDelete"
    />

    <ConfirmModal
      :show="archiveModal.show"
      :title="archiveModalTitle"
      :description="archiveModalMessage"
      :confirm-label="archiveConfirmLabel"
      confirm-variant="secondary"
      @cancel="closeArchiveModal"
      @confirm="confirmArchive"
    />
  </section>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.dashboard-header h1 {
  margin: 0 0 6px;
  font-size: 32px;
}

.subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 18px;
  align-items: end;
}

.filter-group {
  display: flex;
  flex-direction: column;
}

.filter-group.toggle {
  align-items: flex-start;
}

.state {
  text-align: center;
  padding: 32px;
  font-size: 16px;
}

.state.error {
  color: #dc2626;
}

.jobs-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

@media (max-width: 640px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

