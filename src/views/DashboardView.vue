<script setup lang="ts">
import { computed, inject, onMounted, reactive, ref, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import ConfirmModal from '../components/ConfirmModal.vue'
import HistoryEditModal from '../components/dashboard/HistoryEditModal.vue'
import JobCard from '../components/dashboard/JobCard.vue'
import JobFormModal from '../components/dashboard/JobFormModal.vue'
import { useAuthStore } from '../stores/auth'
import { useJobsStore } from '../stores/jobs'
import type { Assignee } from '../types/job'

const jobsStore = useJobsStore()
const authStore = useAuthStore()
const { t } = useI18n()

const { filteredJobs, loading, error } = storeToRefs(jobsStore)

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
const historyEditModal = reactive({
  show: false,
  jobId: null as string | null,
  historyId: null as string | null,
  currentDelta: 0,
})
const historyDeleteModal = reactive({
  show: false,
  jobId: null as string | null,
  historyId: null as string | null,
  jobName: '',
  delta: 0,
})

const modalInitialValues = computed(() => {
  if (!editingJobId.value) return undefined
  const job = jobsStore.jobs.find((item) => item.id === editingJobId.value)
  if (!job) return undefined
  return {
    name: job.name,
    partsNeeded: job.parts_needed,
    assignee: job.assignee as Assignee,
    hasSharePassword: Boolean(job.has_share_password),
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

// Inject and set openCreateModal function ref from App.vue
const openCreateModalRef = inject<Ref<(() => void) | null>>('openCreateModal')
if (openCreateModalRef) {
  openCreateModalRef.value = openCreateModal
}

function openEditModal(jobId: string) {
  modalMode.value = 'edit'
  editingJobId.value = jobId
  showModal.value = true
}

async function handleModalSubmit(payload: {
  name: string
  partsNeeded: number
  assignee: Assignee
  sharePassword?: string | null
}) {
  try {
    if (modalMode.value === 'create') {
      await jobsStore.createJob(payload)
    } else if (editingJobId.value) {
      const updatePayload: {
        name: string
        partsNeeded: number
        assignee: Assignee
        sharePassword?: string | null
      } = {
        name: payload.name,
        partsNeeded: payload.partsNeeded,
        assignee: payload.assignee,
      }
      if (payload.sharePassword != null && payload.sharePassword.trim() !== '') {
        updatePayload.sharePassword = payload.sharePassword
      }
      await jobsStore.updateJob(editingJobId.value, updatePayload)
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

async function handleUpdateNotes(jobId: string, notes: string | null) {
  try {
    await jobsStore.updateJobNotes(jobId, notes)
  } catch (err) {
    console.error(err)
    alert(t('errors.updateJob'))
  }
}

async function handleDelivery(jobId: string, delta: number) {
  try {
    await jobsStore.addDelivery(jobId, delta, authStore.userId)
  } catch (err) {
    console.error(err)
    alert(t('errors.updateProduction'))
  }
}

function handleEditHistory(jobId: string, historyId: string, currentDelta: number) {
  historyEditModal.jobId = jobId
  historyEditModal.historyId = historyId
  historyEditModal.currentDelta = currentDelta
  historyEditModal.show = true
}

function closeHistoryEditModal() {
  historyEditModal.show = false
  historyEditModal.jobId = null
  historyEditModal.historyId = null
  historyEditModal.currentDelta = 0
}

async function handleSaveHistoryEdit(newDelta: number) {
  if (!historyEditModal.jobId || !historyEditModal.historyId) return
  try {
    await jobsStore.updateHistoryItem(historyEditModal.jobId, historyEditModal.historyId, newDelta)
    closeHistoryEditModal()
  } catch (err) {
    console.error(err)
    alert(t('errors.updateProduction'))
  }
}

function handleDeleteHistory(jobId: string, historyId: string) {
  const job = jobsStore.jobs.find((item) => item.id === jobId)
  const historyEntry = job?.job_updates.find((entry) => entry.id === historyId)
  if (!job || !historyEntry) return
  historyDeleteModal.jobId = jobId
  historyDeleteModal.historyId = historyId
  historyDeleteModal.jobName = job.name
  historyDeleteModal.delta = historyEntry.delta
  historyDeleteModal.show = true
}

function closeHistoryDeleteModal() {
  historyDeleteModal.show = false
  historyDeleteModal.jobId = null
  historyDeleteModal.historyId = null
  historyDeleteModal.jobName = ''
  historyDeleteModal.delta = 0
}

async function confirmDeleteHistory() {
  if (!historyDeleteModal.jobId || !historyDeleteModal.historyId) return
  try {
    await jobsStore.deleteHistoryItem(historyDeleteModal.jobId, historyDeleteModal.historyId)
    closeHistoryDeleteModal()
  } catch (err) {
    console.error(err)
    alert(t('errors.updateProduction'))
  }
}


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
        @editHistory="handleEditHistory"
        @deleteHistory="handleDeleteHistory"
        @updateNotes="handleUpdateNotes"
        @delivery="handleDelivery"
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

    <HistoryEditModal
      :show="historyEditModal.show"
      :current-delta="historyEditModal.currentDelta"
      @close="closeHistoryEditModal"
      @save="handleSaveHistoryEdit"
    />

    <ConfirmModal
      :show="historyDeleteModal.show"
      :title="t('jobs.history.deleteTitle')"
      :description="t('jobs.history.deleteMessage', {
        quantity: historyDeleteModal.delta,
        jobName: historyDeleteModal.jobName,
      })"
      :confirm-label="t('jobs.history.delete')"
      confirm-variant="danger"
      @cancel="closeHistoryDeleteModal"
      @confirm="confirmDeleteHistory"
    />
  </section>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
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
</style>

