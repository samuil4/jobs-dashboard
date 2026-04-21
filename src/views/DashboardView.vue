<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, reactive, ref, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { format } from 'date-fns'
import { useI18n } from 'vue-i18n'

import ConfirmModal from '../components/ConfirmModal.vue'
import HistoryEditModal from '../components/dashboard/HistoryEditModal.vue'
import JobCard from '../components/dashboard/JobCard.vue'
import JobFormModal from '../components/dashboard/JobFormModal.vue'
import { useAuthStore } from '../stores/auth'
import { useClientsStore } from '../stores/clients'
import { useJobsStore } from '../stores/jobs'
import type { Assignee, JobPriority, JobWithHistory, UpdateType } from '../types/job'
import {
  NO_PO_KEY,
  UNASSIGNED_KEY,
  groupJobsByClient,
  mergeOrder,
  subgroupJobsByPurchaseOrder,
  swapKeysInOrder,
} from '../utils/clientGroups'

const jobsStore = useJobsStore()
const clientsStore = useClientsStore()
const authStore = useAuthStore()
const { t } = useI18n()

const { filteredMainListJobs, filteredArchivedJobs, loading, error } = storeToRefs(jobsStore)

const LS_ARCHIVED_COLUMN_COLLAPSED = 'dashboard:archivedColumnCollapsed'
const LS_CLIENT_GROUP_ORDER = 'dashboard:clientGroupOrder'
const LS_CLIENT_GROUP_DETAILS_OPEN = 'dashboard:clientGroupDetailsOpen'
const LS_EXPANDED_ARCHIVED_CLIENT_GROUP = 'dashboard:expandedArchivedClientGroupKey'
const LS_PO_SUBGROUP_OPEN = 'dashboard:poSubgroupCollapsed'

type ClientGroupDetailsOpenState = {
  active: Record<string, boolean>
}

function loadClientGroupDetailsOpen(): ClientGroupDetailsOpenState {
  const empty: ClientGroupDetailsOpenState = { active: {} }
  if (typeof localStorage === 'undefined') return empty
  try {
    const raw = localStorage.getItem(LS_CLIENT_GROUP_DETAILS_OPEN)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return empty
    const p = parsed as Record<string, unknown>
    const active =
      p.active && typeof p.active === 'object' && !Array.isArray(p.active)
        ? (p.active as Record<string, boolean>)
        : {}
    return { active: { ...active } }
  } catch {
    return empty
  }
}

const clientGroupDetailsOpen = ref<ClientGroupDetailsOpenState>(loadClientGroupDetailsOpen())

watch(
  clientGroupDetailsOpen,
  () => {
    if (typeof localStorage === 'undefined') return
    try { localStorage.setItem(LS_CLIENT_GROUP_DETAILS_OPEN, JSON.stringify(clientGroupDetailsOpen.value)) } catch { /* storage unavailable */ }
  },
  { deep: true },
)

function loadExpandedArchivedGroupKey(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    let raw = localStorage.getItem(LS_EXPANDED_ARCHIVED_CLIENT_GROUP)
    if (raw === null) {
      raw = localStorage.getItem('dashboard:expandedCompletedClientGroupKey')
    }
    if (raw === null) return null
    const parsed = JSON.parse(raw) as unknown
    if (parsed === null) return null
    if (typeof parsed === 'string') return parsed
    return null
  } catch {
    return null
  }
}

const expandedArchivedGroupKey = ref<string | null>(loadExpandedArchivedGroupKey())

watch(expandedArchivedGroupKey, (k) => {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(LS_EXPANDED_ARCHIVED_CLIENT_GROUP, JSON.stringify(k)) } catch { /* storage unavailable */ }
})

function detailsSectionOpenActive(key: string): boolean {
  const map = clientGroupDetailsOpen.value.active
  if (Object.prototype.hasOwnProperty.call(map, key)) return map[key]!
  return true
}

function onClientGroupDetailsToggleActive(key: string, event: Event) {
  const el = event.currentTarget as HTMLDetailsElement | null
  if (!el || el.tagName !== 'DETAILS') return
  clientGroupDetailsOpen.value = {
    ...clientGroupDetailsOpen.value,
    active: { ...clientGroupDetailsOpen.value.active, [key]: el.open },
  }
}

/** Accordion: at most one archived client group open. */
function onArchivedClientGroupToggle(key: string, event: Event) {
  const el = event.currentTarget as HTMLDetailsElement | null
  if (!el || el.tagName !== 'DETAILS') return
  if (el.open) {
    expandedArchivedGroupKey.value = key
    return
  }
  if (expandedArchivedGroupKey.value === key) {
    expandedArchivedGroupKey.value = null
  }
}

function loadClientGroupOrder(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_CLIENT_GROUP_ORDER)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((x) => String(x))
  } catch {
    return []
  }
}

const clientGroupOrder = ref<string[]>(loadClientGroupOrder())

watch(
  clientGroupOrder,
  (v) => {
    if (typeof localStorage === 'undefined') return
    try { localStorage.setItem(LS_CLIENT_GROUP_ORDER, JSON.stringify(v)) } catch { /* storage unavailable */ }
  },
  { deep: true },
)

function resolveClientLabel(job: JobWithHistory, key: string): string {
  if (key === UNASSIGNED_KEY) return t('jobs.clientUnassigned')
  if (job.client) return job.client.company_name || job.client.username
  return t('jobs.clientUnknown')
}

const orderedActiveGroups = computed(() => {
  const m = groupJobsByClient(filteredMainListJobs.value, resolveClientLabel)
  const keys = mergeOrder(clientGroupOrder.value, m)
  return keys.map((k) => m.get(k)!)
})

const orderedActiveGroupsWithPo = computed(() =>
  orderedActiveGroups.value.map((g) => ({
    ...g,
    poSubgroups: subgroupJobsByPurchaseOrder(g.jobs),
  })),
)

/** PO sections: expanded by default; false = collapsed. Persist only collapsed keys in localStorage. */
function loadPoSubgroupOpen(): Record<string, boolean> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LS_PO_SUBGROUP_OPEN)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, boolean> = {}
    for (const [key, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key === 'string' && key.length > 0 && v === false) {
        out[key] = false
      }
    }
    return out
  } catch {
    return {}
  }
}

function persistPoSubgroupOpen(m: Record<string, boolean>) {
  if (typeof localStorage === 'undefined') return
  const collapsed: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(m)) {
    if (v === false) collapsed[k] = false
  }
  try {
    if (Object.keys(collapsed).length === 0) {
      localStorage.removeItem(LS_PO_SUBGROUP_OPEN)
    } else {
      localStorage.setItem(LS_PO_SUBGROUP_OPEN, JSON.stringify(collapsed))
    }
  } catch {
    /* storage unavailable */
  }
}

const poSubgroupOpen = ref<Record<string, boolean>>(loadPoSubgroupOpen())

watch(poSubgroupOpen, persistPoSubgroupOpen, { deep: true })

function poSubgroupCompositeKey(clientKey: string, poKey: string) {
  return `${clientKey}::${poKey}`
}

function isPoSubgroupOpen(clientKey: string, poKey: string): boolean {
  const k = poSubgroupCompositeKey(clientKey, poKey)
  // Must read poSubgroupOpen.value[k] so the render tracks this ref (hasOwnProperty does not).
  const stored = poSubgroupOpen.value[k]
  return stored === undefined ? true : stored
}

function togglePoSubgroup(clientKey: string, poKey: string) {
  const k = poSubgroupCompositeKey(clientKey, poKey)
  const m = poSubgroupOpen.value
  const cur = m[k] === undefined ? true : m[k]!
  const next = !cur
  const nextMap = { ...m, [k]: next }
  if (next) {
    delete nextMap[k]
  } else {
    nextMap[k] = false
  }
  poSubgroupOpen.value = nextMap
}

function loadArchivedColumnCollapsed(): boolean {
  if (typeof localStorage === 'undefined') return false
  const v = localStorage.getItem(LS_ARCHIVED_COLUMN_COLLAPSED)
  if (v !== null) return v === 'true'
  return localStorage.getItem('dashboard:completedColumnCollapsed') === 'true'
}

const archivedColumnCollapsed = ref(loadArchivedColumnCollapsed())

watch(archivedColumnCollapsed, (collapsed) => {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(LS_ARCHIVED_COLUMN_COLLAPSED, String(collapsed)) } catch { /* storage unavailable */ }
})

function toggleArchivedColumn() {
  archivedColumnCollapsed.value = !archivedColumnCollapsed.value
}

const orderedArchivedGroups = computed(() => {
  const m = groupJobsByClient(filteredArchivedJobs.value, resolveClientLabel)
  const keys = mergeOrder(clientGroupOrder.value, m)
  return keys.map((k) => m.get(k)!)
})

watch(orderedArchivedGroups, (groups) => {
  const keys = new Set(groups.map((g) => g.key))
  if (expandedArchivedGroupKey.value !== null && !keys.has(expandedArchivedGroupKey.value)) {
    expandedArchivedGroupKey.value = null
  }
})

function moveClientSection(column: 'main' | 'archived', key: string, direction: 'up' | 'down') {
  const list = column === 'main' ? filteredMainListJobs.value : filteredArchivedJobs.value
  const columnMap = groupJobsByClient(list, resolveClientLabel)
  const visibleKeys = mergeOrder(clientGroupOrder.value, columnMap)
  const i = visibleKeys.indexOf(key)
  if (i === -1) return
  const j = direction === 'up' ? i - 1 : i + 1
  if (j < 0 || j >= visibleKeys.length) return
  const swapKey = visibleKeys[j]!
  const fullMap = groupJobsByClient(jobsStore.jobs, resolveClientLabel)
  const fullOrder = mergeOrder(clientGroupOrder.value, fullMap)
  clientGroupOrder.value = swapKeysInOrder(fullOrder, key, swapKey)
}

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
    priority: job.priority,
    clientId: job.client_id,
    hasSharePassword: Boolean(job.has_share_password),
    purchaseOrder: job.purchase_order,
    invoice: job.invoice,
  }
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
  priority: JobPriority
  clientId?: string | null
  sharePassword?: string | null
  purchaseOrder?: string | null
  invoice?: string | null
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
        priority: JobPriority
        clientId?: string | null
        sharePassword?: string | null
        purchaseOrder?: string | null
        invoice?: string | null
      } = {
        name: payload.name,
        partsNeeded: payload.partsNeeded,
        assignee: payload.assignee,
        priority: payload.priority,
        clientId: payload.clientId ?? null,
        purchaseOrder: payload.purchaseOrder ?? null,
        invoice: payload.invoice ?? null,
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

async function handleDelivery(
  jobId: string,
  delta: number,
  callbacks?: { onSuccess: () => void; onError: (message: string) => void },
) {
  await withPending(deliveryPendingIds, jobId, async () => {
    try {
      await jobsStore.addDelivery(jobId, delta, authStore.userId)
      callbacks?.onSuccess?.()
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : t('errors.addDelivery')
      if (callbacks?.onError) {
        callbacks.onError(message)
      } else {
        alert(message)
      }
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

const detailJobId = ref<string | null>(null)

const detailJob = computed(() =>
  detailJobId.value ? jobsStore.jobs.find((j) => j.id === detailJobId.value) : undefined,
)

watch(detailJob, (job) => {
  if (detailJobId.value && !job) {
    detailJobId.value = null
  }
})

function openJobDetail(jobId: string) {
  detailJobId.value = jobId
}

function closeJobDetail() {
  detailJobId.value = null
}

function onJobDetailKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && detailJobId.value) {
    closeJobDetail()
  }
}

function rowStatusClass(job: JobWithHistory) {
  if (job.status === 'archived') return 'job-row-archived'
  if (job.status === 'completed') return 'job-row-completed'
  return 'job-row-active'
}

function displayPurchaseOrderCell(job: JobWithHistory) {
  const s = job.purchase_order?.trim()
  return s ? s : null
}

function totalProduced(job: JobWithHistory) {
  return (job.parts_produced ?? 0) + (job.parts_overproduced ?? 0)
}

function partsRemainingRow(job: JobWithHistory) {
  return Math.max(job.parts_needed - job.parts_produced, 0)
}

function readyForDeliveryRow(job: JobWithHistory) {
  return Math.max(0, totalProduced(job) - (job.delivered ?? 0))
}

function handleDeliverAllReady(job: JobWithHistory) {
  const n = readyForDeliveryRow(job)
  if (n <= 0) return
  void handleDelivery(job.id, n)
}

function clientLineLabel(job: JobWithHistory, groupKey: string) {
  if (job.client) return job.client.company_name || job.client.username
  if (groupKey === UNASSIGNED_KEY) return t('jobs.clientUnassigned')
  return t('jobs.clientUnknown')
}

onMounted(async () => {
  window.addEventListener('keydown', onJobDetailKeydown)
  await Promise.all([jobsStore.fetchJobs(), clientsStore.fetchClients()])
})

onUnmounted(() => {
  window.removeEventListener('keydown', onJobDetailKeydown)
})
</script>

<template>
  <section class="dashboard">
    <!-- ── Archived jobs drawer ── -->
    <aside class="archived-column" :class="{ 'is-collapsed': archivedColumnCollapsed }">
      <div v-show="!archivedColumnCollapsed" class="drawer-panel">
        <div class="column-header">
          <h2 class="column-heading">{{ t('jobs.archivedColumn') }}</h2>
        </div>

        <div class="archived-column-body">
          <div
            v-if="!loading && !error && filteredArchivedJobs.length === 0"
            class="card state state-compact"
          >
            {{ t('jobs.archivedDrawerEmpty') }}
          </div>

          <template v-else-if="filteredArchivedJobs.length > 0">
            <details
              v-for="(group, gi) in orderedArchivedGroups"
              :key="group.key"
              :open="expandedArchivedGroupKey === group.key"
              class="client-group client-group-archived-drawer"
              @toggle="onArchivedClientGroupToggle(group.key, $event)"
            >
              <summary class="client-group-summary">
                <span class="client-group-title">{{
                  t('jobs.clientGroupSummary', { name: group.label, count: group.jobs.length })
                }}</span>
                <span class="client-group-actions" @click.stop>
                  <button
                    type="button"
                    class="btn-client-move"
                    :aria-label="t('jobs.moveClientSectionUp')"
                    :disabled="gi === 0"
                    @click="moveClientSection('archived', group.key, 'up')"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="btn-client-move"
                    :aria-label="t('jobs.moveClientSectionDown')"
                    :disabled="gi === orderedArchivedGroups.length - 1"
                    @click="moveClientSection('archived', group.key, 'down')"
                  >
                    ↓
                  </button>
                </span>
              </summary>
              <div class="jobs-archived-stack">
                <JobCard
                  v-for="job in group.jobs"
                  :key="job.id"
                  variant="completed"
                  :job="job"
                  :is-busy="isJobBusy(job.id)"
                  :is-notes-saving="notesPendingIds.has(job.id)"
                  :is-delivery-submitting="deliveryPendingIds.has(job.id)"
                  :is-failed-production-submitting="failedProductionPendingIds.has(job.id)"
                  @edit="openEditModal"
                  @archive="handleArchive"
                  @delete="handleDelete"
                  @editHistory="handleEditHistory"
                  @deleteHistory="handleDeleteHistory"
                  @updateNotes="handleUpdateNotes"
                  @delivery="handleDelivery"
                  @addFailedProduction="handleAddFailedProduction"
                />
              </div>
            </details>
          </template>
        </div>
      </div>

      <!-- Always-visible handle tab -->
      <button
        type="button"
        class="column-toggle-btn"
        :aria-label="archivedColumnCollapsed ? t('jobs.expandArchivedPanel') : t('jobs.collapseArchivedPanel')"
        @click="toggleArchivedColumn"
      >
        <span class="column-toggle-icon" aria-hidden="true">
          {{ archivedColumnCollapsed ? '›' : '‹' }}
        </span>
      </button>
    </aside>

    <!-- ── Main list: active + completed jobs ── -->
    <div v-if="loading" class="card state">{{ t('common.loading') }}…</div>

    <div v-else-if="error" class="card state error">
      {{ t('errors.loadJobs') }}
    </div>

    <template v-else>
      <div v-if="filteredMainListJobs.length === 0" class="card state">
        {{ t('jobs.mainListEmpty') }}
      </div>

      <div v-else class="jobs-by-client">
        <details
          v-for="(group, gi) in orderedActiveGroupsWithPo"
          :key="group.key"
          :open="detailsSectionOpenActive(group.key)"
          class="client-group"
          @toggle="onClientGroupDetailsToggleActive(group.key, $event)"
        >
          <summary class="client-group-summary">
            <span class="client-group-title">{{
              t('jobs.clientGroupSummary', { name: group.label, count: group.jobs.length })
            }}</span>
            <span class="client-group-actions" @click.stop>
              <button
                type="button"
                class="btn-client-move"
                :aria-label="t('jobs.moveClientSectionUp')"
                :disabled="gi === 0"
                @click="moveClientSection('main', group.key, 'up')"
              >
                ↑
              </button>
              <button
                type="button"
                class="btn-client-move"
                :aria-label="t('jobs.moveClientSectionDown')"
                :disabled="gi === orderedActiveGroupsWithPo.length - 1"
                @click="moveClientSection('main', group.key, 'down')"
              >
                ↓
              </button>
            </span>
          </summary>
          <div class="active-table-wrap">
            <div class="table-wrap">
              <table class="staff-jobs-table">
                <thead>
                  <tr>
                    <th>{{ t('jobs.jobName') }}</th>
                    <th>{{ t('jobs.tableColumnParts') }}</th>
                    <th>{{ t('jobs.view') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <template
                    v-for="poSubgroup in group.poSubgroups"
                    :key="`${group.key}:${poSubgroup.key}`"
                  >
                    <tr class="staff-po-subheader">
                      <td colspan="3">
                        <button
                          type="button"
                          class="staff-po-subheader-trigger"
                          :aria-expanded="isPoSubgroupOpen(group.key, poSubgroup.key)"
                          @click.stop="togglePoSubgroup(group.key, poSubgroup.key)"
                        >
                          <span
                            class="staff-po-chevron"
                            aria-hidden="true"
                            :class="{ 'is-collapsed': !isPoSubgroupOpen(group.key, poSubgroup.key) }"
                          />
                          <span v-if="poSubgroup.key === NO_PO_KEY" class="staff-po-subheader-text">{{
                            t('jobs.noPurchaseOrderGroup')
                          }}</span>
                          <span v-else class="staff-po-subheader-text"
                            >PO: {{ poSubgroup.headerPoLabel }}</span
                          >
                        </button>
                      </td>
                    </tr>
                    <tr
                      v-for="job in poSubgroup.jobs"
                      v-show="isPoSubgroupOpen(group.key, poSubgroup.key)"
                      :key="job.id"
                      class="staff-job-row"
                    >
                      <td class="job-name-cell" :class="rowStatusClass(job)">
                        <div class="job-name-block">
                          <div class="job-name-line">
                            <template v-if="displayPurchaseOrderCell(job)">
                              <span class="po-before-name"
                                >PO: {{ displayPurchaseOrderCell(job) }}</span
                              >
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
                          <div class="job-row-secondary">
                            <span>{{ clientLineLabel(job, group.key) }}</span>
                            <span class="job-row-secondary-sep">·</span>
                            <span
                              >{{ t('jobs.dateAdded') }}:
                              {{ format(new Date(job.created_at), 'dd MMM yyyy') }}</span
                            >
                            <span class="job-row-secondary-sep">·</span>
                            <span>{{ t('jobs.assignee') }}: {{ job.assignee }}</span>
                          </div>
                        </div>
                      </td>
                      <td class="staff-parts-cell">
                        <div class="staff-parts-grid">
                          <div class="staff-parts-line">
                            <span
                              ><strong>{{ t('jobs.partsNeeded') }}</strong>
                              {{ job.parts_needed }}</span
                            >
                            <span
                              ><strong>{{ t('jobs.partsProduced') }}</strong>
                              {{ totalProduced(job) }}</span
                            >
                            <span
                              ><strong>{{ t('jobs.partsRemaining') }}</strong>
                              {{ partsRemainingRow(job) }}</span
                            >
                          </div>
                          <div class="staff-parts-line">
                            <span
                              ><strong>{{ t('jobs.delivered') }}</strong>
                              {{ job.delivered ?? 0 }}</span
                            >
                            <span
                              ><strong>{{ t('jobs.partsReadyForDelivery') }}</strong>
                              {{ readyForDeliveryRow(job) }}</span
                            >
                          </div>
                          <div v-if="readyForDeliveryRow(job) > 0" class="staff-deliver-row">
                            <button
                              type="button"
                              class="btn btn-primary btn-compact"
                              :disabled="deliveryPendingIds.has(job.id)"
                              @click="handleDeliverAllReady(job)"
                            >
                              {{
                                deliveryPendingIds.has(job.id)
                                  ? t('common.saving')
                                  : t('jobs.deliverReadyParts', { count: readyForDeliveryRow(job) })
                              }}
                            </button>
                          </div>
                        </div>
                      </td>
                      <td class="staff-view-cell">
                        <button
                          type="button"
                          class="btn btn-secondary btn-compact"
                          @click="openJobDetail(job.id)"
                        >
                          {{ t('jobs.view') }}
                        </button>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>
        </details>
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

    <Teleport to="body">
      <div
        v-if="detailJobId && detailJob"
        class="job-detail-backdrop"
        @click.self="closeJobDetail"
      >
        <aside
          class="job-detail-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="job-detail-drawer-title"
        >
          <header class="job-detail-panel-header">
            <h2 id="job-detail-drawer-title" class="job-detail-panel-title">{{ detailJob.name }}</h2>
            <button type="button" class="btn btn-ghost btn-compact" @click="closeJobDetail">
              {{ t('common.close') }}
            </button>
          </header>
          <div class="job-detail-panel-body">
            <JobCard
              :job="detailJob"
              :variant="detailJob.status === 'completed' ? 'completed' : 'default'"
              :is-busy="isJobBusy(detailJob.id)"
              :is-notes-saving="notesPendingIds.has(detailJob.id)"
              :is-production-submitting="productionPendingIds.has(detailJob.id)"
              :is-delivery-submitting="deliveryPendingIds.has(detailJob.id)"
              :is-failed-production-submitting="failedProductionPendingIds.has(detailJob.id)"
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
        </aside>
      </div>
    </Teleport>
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

.jobs-by-client {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.client-group {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.client-group-archived-drawer {
  flex-shrink: 0;
  min-height: 0;
  box-shadow: none;
  border-radius: 10px;
  background: #fafafa;
}

.client-group-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  list-style: none;
  font-weight: 600;
  font-size: 13px;
  color: #374151;
  user-select: none;
  border-bottom: 1px solid #f3f4f6;
}

.client-group-summary::-webkit-details-marker {
  display: none;
}

.client-group-title {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.client-group-actions {
  display: inline-flex;
  gap: 2px;
  flex-shrink: 0;
}

.btn-client-move {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  color: #6b7280;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}

.btn-client-move:hover:not(:disabled) {
  background: #f3f4f6;
  color: #1f2937;
}

.btn-client-move:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.active-table-wrap {
  padding: 0 0 16px;
}

.table-wrap {
  overflow-x: auto;
}

.staff-jobs-table {
  width: 100%;
  border-collapse: collapse;
}

.staff-jobs-table th,
.staff-jobs-table td {
  padding: 12px 14px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: top;
}

.staff-jobs-table th {
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #6b7280;
  background: #f9fafb;
  font-weight: 700;
  white-space: nowrap;
}

.staff-po-subheader td {
  padding: 0;
  background: #f3f4f6;
  border-bottom: 1px solid #e5e7eb;
}

.staff-po-subheader-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 8px 14px;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6b7280;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.staff-po-subheader-trigger:hover {
  background: #e5e7eb;
}

.staff-po-chevron {
  flex-shrink: 0;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid #6b7280;
  transition: transform 0.15s;
}

.staff-po-chevron.is-collapsed {
  transform: rotate(-90deg);
}

.staff-po-subheader-text {
  display: block;
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
  min-width: 220px;
}

.job-name-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.badge-muted {
  background: #f3f4f6;
  color: #4b5563;
}

.job-row-secondary {
  font-size: 13px;
  color: #4b5563;
  line-height: 1.4;
}

.job-row-secondary-sep {
  margin: 0 4px;
  color: #9ca3af;
}

.staff-parts-cell {
  min-width: 200px;
}

.staff-parts-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.staff-parts-line {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  font-size: 13px;
  color: #374151;
  line-height: 1.4;
}

.staff-parts-line strong {
  font-weight: 600;
  color: #6b7280;
  margin-right: 4px;
}

.staff-deliver-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.staff-view-cell {
  white-space: nowrap;
  vertical-align: middle;
}

.job-detail-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  justify-content: flex-end;
  align-items: stretch;
}

.job-detail-panel {
  width: min(480px, 92vw);
  max-width: 100%;
  background: #fff;
  box-shadow: -8px 0 32px rgba(15, 23, 42, 0.15);
  display: flex;
  flex-direction: column;
  min-height: 0;
  animation: job-detail-slide-in 0.22s ease-out;
}

@keyframes job-detail-slide-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.job-detail-panel-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.job-detail-panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.job-detail-panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  -webkit-overflow-scrolling: touch;
}

.jobs-archived-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 6px 10px;
  max-height: min(60vh, 440px);
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* ── Archived drawer (left) ── */
.archived-column {
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
  width: min(400px, 42vw);
  min-width: 320px;
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

.archived-column-body {
  flex: 1;
  min-height: 0;
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
  .archived-column {
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
