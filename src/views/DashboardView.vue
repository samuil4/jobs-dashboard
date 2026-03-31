<script setup lang="ts">
import { computed, inject, onMounted, reactive, ref, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import ConfirmModal from '../components/ConfirmModal.vue'
import HistoryEditModal from '../components/dashboard/HistoryEditModal.vue'
import JobCard from '../components/dashboard/JobCard.vue'
import JobFormModal from '../components/dashboard/JobFormModal.vue'
import { useAuthStore } from '../stores/auth'
import { useClientsStore } from '../stores/clients'
import { useJobsStore } from '../stores/jobs'
import type { Assignee, UpdateType } from '../types/job'

const jobsStore = useJobsStore()
const clientsStore = useClientsStore()
const authStore = useAuthStore()
const { t } = useI18n()

const { filteredActiveJobs, filteredCompletedJobs, loading, error } = storeToRefs(jobsStore)

const LS_HIDE_ARCHIVED_KEY = 'dashboard:hideArchivedInColumn'

const completedColumnCollapsed = ref(false)
const hideArchivedInColumn = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem(LS_HIDE_ARCHIVED_KEY) === 'true',
)

watch(hideArchivedInColumn, (val) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LS_HIDE_ARCHIVED_KEY, String(val))
})

function toggleCompletedColumn() {
  completedColumnCollapsed.value = !completedColumnCollapsed.value
}

const visibleCompletedJobs = computed(() =>
  hideArchivedInColumn.value
    ? filteredCompletedJobs.value.filter((job) => job.status !== 'archived')
    : filteredCompletedJobs.value,
)

const showModal = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const editingJobId = ref<string | null>(null)
const modalSubmitting = ref(false)
const archiveSubmitting = ref(false)
const deleteSubmitting = ref(false)
const historyEditSubmitting = ref(false)
const historyDeleteSubmitting = ref(false)
const notesPendingIds = reactive(new Set<string>())
const productionPendingIds = reactive(new Set<string>())
const deliveryPendingIds = reactive(new Set<string>())
const failedProductionPendingIds = reactive(new Set<string>())
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
  updateType: undefined as UpdateType | undefined,
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
    clientId: job.client_id,
    hasSharePassword: Boolean(job.has_share_password),
  }
})

onMounted(async () => {
  await Promise.all([jobsStore.fetchJobs(), clientsStore.fetchClients()])
})

async function withPending(set: Set<string>, jobId: string, action: () => Promise<void>) {
  if (set.has(jobId)) return

  set.add(jobId)
  try {
    await action()
  } finally {
    set.delete(jobId)
  }
}

function isJobBusy(jobId: string) {
  return (
    notesPendingIds.has(jobId) ||
    productionPendingIds.has(jobId) ||
    deliveryPendingIds.has(jobId) ||
    failedProductionPendingIds.has(jobId)
  )
}

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
  clientId?: string | null
  sharePassword?: string | null
}) {
  if (modalSubmitting.value) return

  modalSubmitting.value = true
  try {
    if (modalMode.value === 'create') {
      await jobsStore.createJob(payload)
    } else if (editingJobId.value) {
      const updatePayload: {
        name: string
        partsNeeded: number
        assignee: Assignee
        clientId?: string | null
        sharePassword?: string | null
      } = {
        name: payload.name,
        partsNeeded: payload.partsNeeded,
        assignee: payload.assignee,
        clientId: payload.clientId ?? null,
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
  } finally {
    modalSubmitting.value = false
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
  if (!archiveModal.jobId || archiveSubmitting.value) return
  const shouldArchive = archiveModal.action === 'archive'
  archiveSubmitting.value = true
  try {
    await jobsStore.archiveJob(archiveModal.jobId, shouldArchive)
    closeArchiveModal()
  } catch (err) {
    console.error(err)
    alert(t('errors.updateJob'))
  } finally {
    archiveSubmitting.value = false
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
  if (!deleteModal.jobId || deleteSubmitting.value) return
  deleteSubmitting.value = true
  try {
    await jobsStore.deleteJob(deleteModal.jobId)
    closeDeleteModal()
  } catch (err) {
    console.error(err)
    alert(t('errors.deleteJob'))
  } finally {
    deleteSubmitting.value = false
  }
}

async function handleProduction(jobId: string, delta: number) {
  await withPending(productionPendingIds, jobId, async () => {
    try {
      await jobsStore.addProduction(jobId, delta, authStore.userId)
    } catch (err) {
      console.error(err)
      alert(t('errors.updateProduction'))
    }
  })
}

async function handleUpdateNotes(jobId: string, notes: string | null) {
  await withPending(notesPendingIds, jobId, async () => {
    try {
      await jobsStore.updateJobNotes(jobId, notes)
    } catch (err) {
      console.error(err)
      alert(t('errors.updateJob'))
    }
  })
}

async function handleDelivery(jobId: string, delta: number) {
  await withPending(deliveryPendingIds, jobId, async () => {
    try {
      await jobsStore.addDelivery(jobId, delta, authStore.userId)
    } catch (err) {
      console.error(err)
      alert(t('errors.updateProduction'))
    }
  })
}

async function handleAddFailedProduction(
  jobId: string,
  delta: number,
  callbacks?: { onSuccess: () => void; onError: (message: string) => void },
) {
  await withPending(failedProductionPendingIds, jobId, async () => {
    try {
      await jobsStore.addFailedProduction(jobId, delta, authStore.userId)
      callbacks?.onSuccess?.()
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : t('errors.addFailedProduction')
      if (callbacks?.onError) {
        callbacks.onError(message)
      } else {
        alert(t('errors.addFailedProduction'))
      }
    }
  })
}

function handleEditHistory(
  jobId: string,
  historyId: string,
  currentDelta: number,
  updateType?: UpdateType,
) {
  historyEditModal.jobId = jobId
  historyEditModal.historyId = historyId
  historyEditModal.currentDelta = currentDelta
  historyEditModal.updateType = updateType
  historyEditModal.show = true
}

function closeHistoryEditModal() {
  historyEditModal.show = false
  historyEditModal.jobId = null
  historyEditModal.historyId = null
  historyEditModal.currentDelta = 0
  historyEditModal.updateType = undefined
}

async function handleSaveHistoryEdit(newDelta: number) {
  if (!historyEditModal.jobId || !historyEditModal.historyId || historyEditSubmitting.value) return
  historyEditSubmitting.value = true
  try {
    await jobsStore.updateHistoryItem(historyEditModal.jobId, historyEditModal.historyId, newDelta)
    closeHistoryEditModal()
  } catch (err) {
    console.error(err)
    alert(t('errors.updateProduction'))
  } finally {
    historyEditSubmitting.value = false
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
  if (!historyDeleteModal.jobId || !historyDeleteModal.historyId || historyDeleteSubmitting.value)
    return
  historyDeleteSubmitting.value = true
  try {
    await jobsStore.deleteHistoryItem(historyDeleteModal.jobId, historyDeleteModal.historyId)
    closeHistoryDeleteModal()
  } catch (err) {
    console.error(err)
    alert(t('errors.updateProduction'))
  } finally {
    historyDeleteSubmitting.value = false
  }
}

const archiveModalTitle = computed(() =>
  archiveModal.action === 'archive'
    ? t('jobs.archiveModal.archiveTitle')
    : t('jobs.archiveModal.unarchiveTitle'),
)

const archiveModalMessage = computed(() =>
  archiveModal.action === 'archive'
    ? t('jobs.archiveModal.archiveMessage', { name: archiveModal.jobName })
    : t('jobs.archiveModal.unarchiveMessage', { name: archiveModal.jobName }),
)

const archiveConfirmLabel = computed(() =>
  archiveModal.action === 'archive' ? t('jobs.archive') : t('jobs.unarchive'),
)
</script>

<template>
  <section class="dashboard">
    <!-- ── Fixed completed-jobs drawer ── -->
    <aside class="completed-column" :class="{ 'is-collapsed': completedColumnCollapsed }">
      <!-- Slide-in panel -->
      <div v-show="!completedColumnCollapsed" class="drawer-panel">
        <div class="column-header">
          <h2 class="column-heading">{{ t('jobs.completedColumn') }}</h2>
          <button
            type="button"
            class="btn-archived-toggle"
            :class="{ 'is-active': hideArchivedInColumn }"
            @click="hideArchivedInColumn = !hideArchivedInColumn"
          >
            {{
              hideArchivedInColumn ? t('jobs.filter.showArchived') : t('jobs.filter.hideArchived')
            }}
          </button>
        </div>

        <div class="completed-column-body">
          <div
            v-if="!loading && !error && visibleCompletedJobs.length === 0"
            class="card state state-compact"
          >
            {{ t('jobs.completedEmpty') }}
          </div>

          <JobCard
            v-for="job in visibleCompletedJobs"
            :key="job.id"
            variant="completed"
            :job="job"
            :is-busy="isJobBusy(job.id)"
            :is-notes-saving="notesPendingIds.has(job.id)"
            :is-failed-production-submitting="failedProductionPendingIds.has(job.id)"
            @edit="openEditModal"
            @archive="handleArchive"
            @delete="handleDelete"
            @editHistory="handleEditHistory"
            @deleteHistory="handleDeleteHistory"
            @addFailedProduction="handleAddFailedProduction"
          />
        </div>
      </div>

      <!-- Always-visible handle tab -->
      <button
        type="button"
        class="column-toggle-btn"
        :aria-label="completedColumnCollapsed ? t('jobs.expandColumn') : t('jobs.collapseColumn')"
        @click="toggleCompletedColumn"
      >
        <span class="column-toggle-icon" aria-hidden="true">
          {{ completedColumnCollapsed ? '›' : '‹' }}
        </span>
      </button>
    </aside>

    <!-- ── Main content: full-width active jobs ── -->
    <div v-if="loading" class="card state">{{ t('common.loading') }}…</div>

    <div v-else-if="error" class="card state error">
      {{ t('errors.loadJobs') }}
    </div>

    <template v-else>
      <div v-if="filteredActiveJobs.length === 0" class="card state">
        {{ t('jobs.activeEmpty') }}
      </div>

      <div v-else class="jobs-grid">
        <JobCard
          v-for="job in filteredActiveJobs"
          :key="job.id"
          :job="job"
          :is-busy="isJobBusy(job.id)"
          :is-notes-saving="notesPendingIds.has(job.id)"
          :is-production-submitting="productionPendingIds.has(job.id)"
          :is-delivery-submitting="deliveryPendingIds.has(job.id)"
          :is-failed-production-submitting="failedProductionPendingIds.has(job.id)"
          @edit="openEditModal"
          @archive="handleArchive"
          @delete="handleDelete"
          @production="handleProduction"
          @editHistory="handleEditHistory"
          @deleteHistory="handleDeleteHistory"
          @updateNotes="handleUpdateNotes"
          @delivery="handleDelivery"
          @addFailedProduction="handleAddFailedProduction"
        />
      </div>
    </template>

    <JobFormModal
      :show="showModal"
      :mode="modalMode"
      :submitting="modalSubmitting"
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
      :confirming="deleteSubmitting"
      @cancel="closeDeleteModal"
      @confirm="confirmDelete"
    />

    <ConfirmModal
      :show="archiveModal.show"
      :title="archiveModalTitle"
      :description="archiveModalMessage"
      :confirm-label="archiveConfirmLabel"
      confirm-variant="secondary"
      :confirming="archiveSubmitting"
      @cancel="closeArchiveModal"
      @confirm="confirmArchive"
    />

    <HistoryEditModal
      :show="historyEditModal.show"
      :current-delta="historyEditModal.currentDelta"
      :update-type="historyEditModal.updateType"
      :submitting="historyEditSubmitting"
      @close="closeHistoryEditModal"
      @save="handleSaveHistoryEdit"
    />

    <ConfirmModal
      :show="historyDeleteModal.show"
      :title="t('jobs.history.deleteTitle')"
      :description="
        t('jobs.history.deleteMessage', {
          quantity: historyDeleteModal.delta,
          jobName: historyDeleteModal.jobName,
        })
      "
      :confirm-label="t('jobs.history.delete')"
      confirm-variant="danger"
      :confirming="historyDeleteSubmitting"
      @cancel="closeHistoryDeleteModal"
      @confirm="confirmDeleteHistory"
    />
  </section>
</template>

<style scoped>
/* ── Active jobs area ── */
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

.state-compact {
  padding: 16px 12px;
  font-size: 13px;
}

.jobs-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

/* ── Fixed drawer ── */
.completed-column {
  position: fixed;
  left: 0;
  top: 56px;
  bottom: 48px;
  z-index: 50;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  pointer-events: none; /* let clicks through the transparent toggle area */
}

/* Panel */
.drawer-panel {
  width: 300px;
  height: 100%;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  box-shadow: 4px 0 28px rgba(15, 23, 42, 0.13);
  display: flex;
  flex-direction: column;
  pointer-events: all;
  overflow: hidden;
}

.column-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid #f3f4f6;
}

.column-heading {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #6b7280;
}

.btn-archived-toggle {
  flex-shrink: 0;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}

.btn-archived-toggle:hover,
.btn-archived-toggle.is-active {
  background: #f3f4f6;
  color: #374151;
  border-color: #d1d5db;
}

.completed-column-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 10px 24px;
}

/* Handle tab that sticks out to the right */
.column-toggle-btn {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 20px;
  width: 22px;
  height: 52px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-left: none;
  border-radius: 0 8px 8px 0;
  box-shadow: 4px 0 10px rgba(15, 23, 42, 0.08);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: #6b7280;
  pointer-events: all;
  transition:
    background 0.15s,
    color 0.15s;
}

.column-toggle-btn:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.column-toggle-icon {
  display: block;
  line-height: 1;
  font-weight: 700;
}

/* ── Responsive: mobile ── */
@media (max-width: 768px) {
  .completed-column {
    top: auto;
    bottom: 48px;
    left: 0;
    right: 0;
    height: auto;
    flex-direction: column-reverse;
    align-items: flex-start;
  }

  .drawer-panel {
    width: 100%;
    max-height: 50vh;
    border-right: none;
    border-top: 1px solid #e5e7eb;
    box-shadow: 0 -4px 20px rgba(15, 23, 42, 0.1);
  }

  .column-toggle-btn {
    align-self: auto;
    margin-top: 0;
    width: 52px;
    height: 22px;
    border: 1px solid #e5e7eb;
    border-bottom: none;
    border-radius: 8px 8px 0 0;
    box-shadow: 0 -2px 6px rgba(15, 23, 42, 0.06);
  }
}
</style>
