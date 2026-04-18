import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import bcrypt from 'bcryptjs'
import { formatISO } from 'date-fns'

import { supabase } from '../lib/supabase'
import type {
  Assignee,
  JobPriority,
  JobRecord,
  JobUpdateRecord,
  JobWithHistory,
  NewJobPayload,
  UpdateJobPayload,
} from '../types/job'

export const ASSIGNEE_OPTIONS: Assignee[] = ['Samuil', 'Oleksii', 'Veselin']
export const DEFAULT_ASSIGNEE: Assignee = ASSIGNEE_OPTIONS[0]!

export const JOB_PRIORITY_OPTIONS: JobPriority[] = ['low', 'normal', 'high', 'urgent']
export const DEFAULT_JOB_PRIORITY: JobPriority = 'normal'

const JOB_SELECT_FIELDS =
  'id, name, purchase_order, invoice, parts_needed, parts_produced, parts_overproduced, notes, delivered, parts_failed, archived, status, priority, assignee, created_at, updated_at, client_id, has_share_password, client:clients(id, username, company_name), job_updates (*)'

type StatusFilter = 'all' | 'active' | 'completed' | 'archived'
type SelectedJobResponse = Omit<JobRecord, 'client'> & {
  client?: JobRecord['client'] | NonNullable<JobRecord['client']>[]
  job_updates: JobUpdateRecord[] | null
}
type NormalizedSelectedJobRow = JobRecord & {
  job_updates: JobUpdateRecord[] | null
}

export const useJobsStore = defineStore('jobs', () => {
  const jobs = ref<JobWithHistory[]>([])
  const loading = ref(false)
  /** Coordinates concurrent `fetchJobs` so `loading` clears when the last call finishes. */
  let fetchJobsInFlight = 0
  const error = ref<string | null>(null)
  const searchTerm = ref('')
  const statusFilter = ref<StatusFilter>('all')
  const LS_SHOW_ARCHIVED_KEY = 'jobs:showArchived'
  const showArchived = ref(
    typeof localStorage !== 'undefined' && localStorage.getItem(LS_SHOW_ARCHIVED_KEY) === 'true',
  )

  watch(showArchived, (val) => {
    localStorage.setItem(LS_SHOW_ARCHIVED_KEY, String(val))
  })

  function withHistory(job: JobRecord, history: JobUpdateRecord[] | null): JobWithHistory {
    return {
      ...job,
      job_updates: history?.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ) ?? [],
    }
  }

  function parseSelectedJobRow(row: unknown): NormalizedSelectedJobRow {
    const selected = row as SelectedJobResponse
    return {
      ...selected,
      purchase_order: selected.purchase_order ?? null,
      invoice: selected.invoice ?? null,
      client: Array.isArray(selected.client) ? selected.client[0] ?? null : selected.client ?? null,
    }
  }

  async function fetchJobs() {
    fetchJobsInFlight += 1
    loading.value = true
    error.value = null
    try {
      const { data, error: fetchError } = await supabase
        .from('jobs')
        .select(JOB_SELECT_FIELDS)
        .order('created_at', { ascending: false })

      if (fetchError) {
        error.value = fetchError.message
        return
      }

      jobs.value =
        data?.map((item) => {
          const { job_updates, ...rest } = parseSelectedJobRow(item)
          return withHistory(rest, job_updates)
        }) ?? []
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      fetchJobsInFlight -= 1
      if (fetchJobsInFlight <= 0) {
        fetchJobsInFlight = 0
        loading.value = false
      }
    }
  }

  async function createJob(payload: NewJobPayload) {
    error.value = null
    const now = formatISO(new Date())
    // Share passwords are hashed with bcrypt ($2b$) via bcryptjs; backend verifies via extensions.crypt
    const sharePasswordHash =
      payload.sharePassword != null && payload.sharePassword.trim() !== ''
        ? await bcrypt.hash(payload.sharePassword.trim(), 10)
        : null
    const po =
      payload.purchaseOrder != null && payload.purchaseOrder.trim() !== ''
        ? payload.purchaseOrder.trim()
        : null
    const inv =
      payload.invoice != null && payload.invoice.trim() !== ''
        ? payload.invoice.trim()
        : null
    const insertPayload: Record<string, unknown> = {
      name: payload.name,
      purchase_order: po,
      invoice: inv,
      parts_needed: payload.partsNeeded,
      parts_produced: 0,
      parts_overproduced: 0,
      notes: null,
      delivered: 0,
      parts_failed: 0,
      archived: false,
      status: 'active',
      priority: payload.priority,
      assignee: payload.assignee,
      client_id: payload.clientId ?? null,
      created_at: now,
      updated_at: now,
    }
    if (sharePasswordHash !== null) {
      insertPayload.share_password_hash = sharePasswordHash
    }
    const { data, error: insertError } = await supabase
      .from('jobs')
      .insert(insertPayload)
      .select(JOB_SELECT_FIELDS)
      .single()

    if (insertError) {
      error.value = insertError.message
      throw insertError
    }

    const { job_updates, ...rest } = parseSelectedJobRow(data)
    jobs.value = [withHistory(rest, job_updates), ...jobs.value]
  }

  async function updateJob(id: string, payload: UpdateJobPayload) {
    error.value = null
    const job = jobs.value.find((j) => j.id === id)
    if (!job) return

    // Calculate current total production
    const currentTotal = job.parts_produced + (job.parts_overproduced ?? 0)

    // Recalculate parts_produced and parts_overproduced based on new parts_needed
    let newPartsProduced: number
    let newPartsOverproduced: number

    if (payload.partsNeeded >= currentTotal) {
      // New parts_needed is greater than or equal to current total
      // All production counts as requested production
      newPartsProduced = currentTotal
      newPartsOverproduced = 0
    } else {
      // New parts_needed is less than current total
      // Cap parts_produced at new parts_needed, rest goes to overproduction
      newPartsProduced = payload.partsNeeded
      newPartsOverproduced = currentTotal - payload.partsNeeded
    }

    const newStatus =
      newPartsProduced >= payload.partsNeeded ? ('completed' as const) : ('active' as const)
    // Share passwords are hashed with bcrypt ($2b$) via bcryptjs; backend verifies via extensions.crypt
    const sharePasswordHash =
      payload.sharePassword !== undefined
        ? payload.sharePassword != null && payload.sharePassword.trim() !== ''
          ? await bcrypt.hash(payload.sharePassword.trim(), 10)
          : null
        : undefined
    const po =
      payload.purchaseOrder != null && payload.purchaseOrder.trim() !== ''
        ? payload.purchaseOrder.trim()
        : null
    const inv =
      payload.invoice != null && payload.invoice.trim() !== ''
        ? payload.invoice.trim()
        : null
    const updatePayload: Record<string, unknown> = {
      name: payload.name,
      purchase_order: po,
      invoice: inv,
      parts_needed: payload.partsNeeded,
      parts_produced: newPartsProduced,
      parts_overproduced: newPartsOverproduced,
      assignee: payload.assignee,
      priority: payload.priority,
      client_id: payload.clientId ?? null,
      status: job.archived ? 'archived' : newStatus,
      updated_at: formatISO(new Date()),
    }
    if (sharePasswordHash !== undefined) {
      updatePayload.share_password_hash = sharePasswordHash
    }
    const { data, error: updateError } = await supabase
      .from('jobs')
      .update(updatePayload)
      .eq('id', id)
      .select(JOB_SELECT_FIELDS)
      .single()

    if (updateError) {
      error.value = updateError.message
      throw updateError
    }

    const { job_updates, ...rest } = parseSelectedJobRow(data)
    jobs.value = jobs.value.map((item) => (item.id === id ? withHistory(rest, job_updates) : item))
  }

  async function archiveJob(id: string, archivedValue: boolean) {
    error.value = null
    const job = jobs.value.find((j) => j.id === id)
    if (!job) {
      throw new Error('Job not found in the current list. Try refreshing the page.')
    }

    const status = archivedValue
      ? ('archived' as const)
      : job.parts_produced >= job.parts_needed
        ? ('completed' as const)
        : ('active' as const)
    const updatedAt = formatISO(new Date())

    try {
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          archived: archivedValue,
          status,
          updated_at: updatedAt,
        })
        .eq('id', id)

      if (updateError) {
        error.value = updateError.message
        throw updateError
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to archive job'
      throw e
    }

    jobs.value = jobs.value.map((item) =>
      item.id === id
        ? {
            ...item,
            archived: archivedValue,
            status,
            updated_at: updatedAt,
          }
        : item
    )
  }

  async function deleteJob(id: string) {
    error.value = null
    const { error: deleteError } = await supabase.from('jobs').delete().eq('id', id)

    if (deleteError) {
      error.value = deleteError.message
      throw deleteError
    }

    jobs.value = jobs.value.filter((job) => job.id !== id)
  }

  async function addProduction(id: string, delta: number, updatedBy?: string | null) {
    error.value = null
    const job = jobs.value.find((j) => j.id === id)
    if (!job) return

    if (delta <= 0) {
      throw new Error('Delta must be positive')
    }

    // Calculate current total production (including overproduction)
    const currentTotalProduced = job.parts_produced + (job.parts_overproduced ?? 0)

    // Calculate new total after adding delta
    const newTotalProduced = currentTotalProduced + delta

    // Calculate new parts_produced (capped at parts_needed)
    const newPartsProduced = Math.min(newTotalProduced, job.parts_needed)

    // Calculate new parts_overproduced (excess beyond parts_needed)
    const newPartsOverproduced = Math.max(0, newTotalProduced - job.parts_needed)

    // Determine status based on parts_produced
    const status = newPartsProduced >= job.parts_needed ? ('completed' as const) : ('active' as const)
    const now = formatISO(new Date())

    const { data: rpcData, error: rpcError } = await supabase.rpc('add_production', {
      p_job_id: id,
      p_delta: delta,
      p_updated_by: updatedBy ?? null,
      p_created_at: now,
    })

    if (rpcError) {
      error.value = rpcError.message
      throw rpcError
    }

    const newHistoryRecord = parseJobUpdateRecord(rpcData)

    jobs.value = jobs.value.map((item) => {
      if (item.id !== id) return item
      return {
        ...item,
        parts_produced: newPartsProduced,
        parts_overproduced: newPartsOverproduced,
        status: job.archived ? 'archived' : status,
        updated_at: now,
        job_updates: [newHistoryRecord, ...item.job_updates],
      }
    })
  }

  function matchesSearch(job: JobWithHistory, query: string): boolean {
    if (!query) return true
    const po = job.purchase_order?.trim().toLowerCase() ?? ''
    const inv = job.invoice?.trim().toLowerCase() ?? ''
    return (
      job.name.toLowerCase().includes(query) ||
      job.assignee.toLowerCase().includes(query) ||
      (po && po.includes(query)) ||
      (inv && inv.includes(query)) ||
      (job.client?.company_name?.toLowerCase().includes(query) ?? false) ||
      (job.client?.username?.toLowerCase().includes(query) ?? false)
    )
  }

  const filteredJobs = computed(() => {
    const query = searchTerm.value.trim().toLowerCase()
    return jobs.value.filter((job) => {
      if (!showArchived.value && job.archived && statusFilter.value !== 'archived') {
        return false
      }
      if (statusFilter.value !== 'all' && job.status !== statusFilter.value) {
        return false
      }
      return matchesSearch(job, query)
    })
  })

  /** Dashboard main list: active and completed jobs (archived live in the side drawer only). */
  const filteredMainListJobs = computed(() => {
    const query = searchTerm.value.trim().toLowerCase()
    if (statusFilter.value === 'archived') {
      return []
    }
    return jobs.value.filter((job) => {
      if (job.status !== 'active' && job.status !== 'completed') {
        return false
      }
      if (statusFilter.value === 'active' && job.status !== 'active') {
        return false
      }
      if (statusFilter.value === 'completed' && job.status !== 'completed') {
        return false
      }
      return matchesSearch(job, query)
    })
  })

  /** Left drawer on staff dashboard: archived jobs only. */
  const filteredArchivedJobs = computed(() => {
    const query = searchTerm.value.trim().toLowerCase()
    if (statusFilter.value !== 'all' && statusFilter.value !== 'archived') {
      return []
    }
    return jobs.value.filter((job) => {
      if (job.status !== 'archived') return false
      return matchesSearch(job, query)
    })
  })

  function setSearch(value: string) {
    searchTerm.value = value
  }

  function setStatus(value: StatusFilter) {
    statusFilter.value = value
  }

  function toggleArchivedVisibility() {
    showArchived.value = !showArchived.value
  }

  function mergeJobUpdate(jobId: string, update: JobUpdateRecord) {
    jobs.value = jobs.value.map((item) => {
      if (item.id !== jobId) return item
      // Avoid duplicate: same update may already exist (e.g. from fetchJobs race)
      if (item.job_updates.some((u) => u.id === update.id)) return item
      const newHistory = [update, ...item.job_updates]

      // Incremental update: apply the new update's delta to current values instead of
      // recalculating from full history (avoids mismatch from history representation issues)
      const updateType = update.update_type ?? 'production'
      let partsProduced = item.parts_produced
      let partsOverproduced = item.parts_overproduced ?? 0
      let delivered = item.delivered ?? 0
      let partsFailed = item.parts_failed ?? 0

      if (updateType === 'production') {
        const currentTotal = partsProduced + partsOverproduced
        const newTotal = currentTotal + update.delta
        partsProduced = Math.min(newTotal, item.parts_needed)
        partsOverproduced = Math.max(0, newTotal - item.parts_needed)
      } else if (updateType === 'delivery') {
        delivered += update.delta
      } else if (updateType === 'failed_production') {
        partsFailed += update.delta
      }

      const status = item.archived
        ? ('archived' as const)
        : partsProduced >= item.parts_needed
          ? ('completed' as const)
          : ('active' as const)

      return {
        ...item,
        parts_produced: partsProduced,
        parts_overproduced: partsOverproduced,
        status,
        delivered,
        parts_failed: partsFailed,
        updated_at: update.created_at,
        job_updates: newHistory,
      }
    })
  }

  function recalculateJobProduction(
    historyEntries: JobUpdateRecord[],
    job: JobRecord
  ): {
    parts_produced: number
    parts_overproduced: number
    status: 'active' | 'completed' | 'archived'
  } {
    // Sum deltas from production entries only (exclude delivery and failed_production)
    const totalProduced = historyEntries
      .filter((e) => e.update_type === 'production')
      .reduce((sum, entry) => sum + entry.delta, 0)

    // Calculate parts_produced (capped at parts_needed)
    // This represents the requested parts that have been produced
    const newPartsProduced = Math.min(totalProduced, job.parts_needed)

    // Calculate parts_overproduced (excess beyond parts_needed)
    // This represents extra parts produced beyond what was requested
    const newPartsOverproduced = Math.max(0, totalProduced - job.parts_needed)

    // Determine status based on production vs needed
    // If job is archived, preserve archived status
    // If parts_produced >= parts_needed, job is completed
    // Otherwise, job is active
    const newStatus = job.archived
      ? ('archived' as const)
      : newPartsProduced >= job.parts_needed
        ? ('completed' as const)
        : ('active' as const)

    return {
      parts_produced: newPartsProduced,
      parts_overproduced: newPartsOverproduced,
      status: newStatus,
    }
  }

  function recalculateJobDelivered(historyEntries: JobUpdateRecord[]): number {
    return historyEntries
      .filter((e) => e.update_type === 'delivery')
      .reduce((sum, entry) => sum + entry.delta, 0)
  }

  function recalculateJobFailed(historyEntries: JobUpdateRecord[]): number {
    return historyEntries
      .filter((e) => e.update_type === 'failed_production')
      .reduce((sum, entry) => sum + entry.delta, 0)
  }

  async function deleteHistoryItem(jobId: string, historyId: string) {
    error.value = null
    const job = jobs.value.find((j) => j.id === jobId)
    if (!job) {
      throw new Error('Job not found')
    }

    const { data: persistedEntry, error: fetchEntryError } = await supabase
      .from('job_updates')
      .select('update_type, job_id')
      .eq('id', historyId)
      .single()

    if (fetchEntryError || !persistedEntry) {
      error.value = fetchEntryError?.message ?? 'History entry not found'
      throw fetchEntryError ?? new Error('History entry not found')
    }

    if (persistedEntry.job_id !== jobId) {
      error.value = 'History entry does not belong to this job'
      throw new Error('History entry does not belong to this job')
    }

    const isDelivery = persistedEntry.update_type === 'delivery'
    const isFailedProduction = persistedEntry.update_type === 'failed_production'

    // Delete the history entry from database
    const { error: deleteError } = await supabase.from('job_updates').delete().eq('id', historyId)

    if (deleteError) {
      error.value = deleteError.message
      throw deleteError
    }

    // Fetch all remaining history entries for the job
    const { data: remainingHistory, error: fetchError } = await supabase
      .from('job_updates')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      error.value = fetchError.message
      throw fetchError
    }

    const historyEntries = (remainingHistory ?? []) as JobUpdateRecord[]
    const now = formatISO(new Date())

    if (isDelivery) {
      const newDelivered = recalculateJobDelivered(historyEntries)
      const { data: updatedJob, error: updateError } = await supabase
        .from('jobs')
        .update({ delivered: newDelivered, updated_at: now })
        .eq('id', jobId)
        .select(JOB_SELECT_FIELDS)
        .single()

      if (updateError) {
        error.value = updateError.message
        throw updateError
      }

      const { job_updates, ...rest } = parseSelectedJobRow(updatedJob)
      jobs.value = jobs.value.map((item) =>
        item.id === jobId ? withHistory(rest, job_updates) : item
      )
    } else if (isFailedProduction) {
      const newPartsFailed = recalculateJobFailed(historyEntries)
      const { data: updatedJob, error: updateError } = await supabase
        .from('jobs')
        .update({ parts_failed: newPartsFailed, updated_at: now })
        .eq('id', jobId)
        .select(JOB_SELECT_FIELDS)
        .single()

      if (updateError) {
        error.value = updateError.message
        throw updateError
      }

      const { job_updates, ...rest } = parseSelectedJobRow(updatedJob)
      jobs.value = jobs.value.map((item) =>
        item.id === jobId ? withHistory(rest, job_updates) : item
      )
    } else {
      const recalculated = recalculateJobProduction(historyEntries, job)
      const totalProduced =
        recalculated.parts_produced + recalculated.parts_overproduced
      const clampedDelivered = Math.min(job.delivered ?? 0, totalProduced)
      const { data: updatedJob, error: updateError } = await supabase
        .from('jobs')
        .update({
          parts_produced: recalculated.parts_produced,
          parts_overproduced: recalculated.parts_overproduced,
          delivered: clampedDelivered,
          status: recalculated.status,
          updated_at: now,
        })
        .eq('id', jobId)
        .select(JOB_SELECT_FIELDS)
        .single()

      if (updateError) {
        error.value = updateError.message
        throw updateError
      }

      const { job_updates, ...rest } = parseSelectedJobRow(updatedJob)
      jobs.value = jobs.value.map((item) =>
        item.id === jobId ? withHistory(rest, job_updates) : item
      )
    }
  }

  async function updateHistoryItem(jobId: string, historyId: string, newDelta: number) {
    error.value = null

    if (newDelta <= 0) {
      throw new Error('Delta must be positive')
    }

    const job = jobs.value.find((j) => j.id === jobId)
    if (!job) {
      throw new Error('Job not found')
    }

    const { data: persistedEntry, error: fetchEntryError } = await supabase
      .from('job_updates')
      .select('update_type, job_id')
      .eq('id', historyId)
      .single()

    if (fetchEntryError || !persistedEntry) {
      error.value = fetchEntryError?.message ?? 'History entry not found'
      throw fetchEntryError ?? new Error('History entry not found')
    }

    if (persistedEntry.job_id !== jobId) {
      error.value = 'History entry does not belong to this job'
      throw new Error('History entry does not belong to this job')
    }

    const isDelivery = persistedEntry.update_type === 'delivery'
    const isFailedProduction = persistedEntry.update_type === 'failed_production'

    // Update the history entry in database
    const { error: updateError } = await supabase
      .from('job_updates')
      .update({ delta: newDelta })
      .eq('id', historyId)

    if (updateError) {
      error.value = updateError.message
      throw updateError
    }

    // Fetch all history entries for the job (including updated one)
    const { data: allHistory, error: fetchError } = await supabase
      .from('job_updates')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      error.value = fetchError.message
      throw fetchError
    }

    const historyEntries = (allHistory ?? []) as JobUpdateRecord[]
    const now = formatISO(new Date())

    if (isDelivery) {
      const newDelivered = recalculateJobDelivered(historyEntries)
      const { data: updatedJob, error: jobUpdateError } = await supabase
        .from('jobs')
        .update({ delivered: newDelivered, updated_at: now })
        .eq('id', jobId)
        .select(JOB_SELECT_FIELDS)
        .single()

      if (jobUpdateError) {
        error.value = jobUpdateError.message
        throw jobUpdateError
      }

      const { job_updates, ...rest } = parseSelectedJobRow(updatedJob)
      jobs.value = jobs.value.map((item) =>
        item.id === jobId ? withHistory(rest, job_updates) : item
      )
    } else if (isFailedProduction) {
      const newPartsFailed = recalculateJobFailed(historyEntries)
      const { data: updatedJob, error: jobUpdateError } = await supabase
        .from('jobs')
        .update({ parts_failed: newPartsFailed, updated_at: now })
        .eq('id', jobId)
        .select(JOB_SELECT_FIELDS)
        .single()

      if (jobUpdateError) {
        error.value = jobUpdateError.message
        throw jobUpdateError
      }

      const { job_updates, ...rest } = parseSelectedJobRow(updatedJob)
      jobs.value = jobs.value.map((item) =>
        item.id === jobId ? withHistory(rest, job_updates) : item
      )
    } else {
      const recalculated = recalculateJobProduction(historyEntries, job)
      const totalProduced =
        recalculated.parts_produced + recalculated.parts_overproduced
      const clampedDelivered = Math.min(job.delivered ?? 0, totalProduced)
      const { data: updatedJob, error: jobUpdateError } = await supabase
        .from('jobs')
        .update({
          parts_produced: recalculated.parts_produced,
          parts_overproduced: recalculated.parts_overproduced,
          delivered: clampedDelivered,
          status: recalculated.status,
          updated_at: now,
        })
        .eq('id', jobId)
        .select(JOB_SELECT_FIELDS)
        .single()

      if (jobUpdateError) {
        error.value = jobUpdateError.message
        throw jobUpdateError
      }

      const { job_updates, ...rest } = parseSelectedJobRow(updatedJob)
      jobs.value = jobs.value.map((item) =>
        item.id === jobId ? withHistory(rest, job_updates) : item
      )
    }
  }

  const NOTES_MAX_LENGTH = 2000

  async function updateJobNotes(id: string, notes: string | null) {
    error.value = null
    const job = jobs.value.find((j) => j.id === id)
    if (!job) {
      throw new Error('Job not found')
    }
    const trimmed = notes === null || notes === '' ? null : notes.trim()
    if (trimmed !== null && trimmed.length > NOTES_MAX_LENGTH) {
      throw new Error(`Notes must be at most ${NOTES_MAX_LENGTH} characters`)
    }
    const now = formatISO(new Date())
    const { data, error: updateError } = await supabase
      .from('jobs')
      .update({ notes: trimmed, updated_at: now })
      .eq('id', id)
      .select(JOB_SELECT_FIELDS)
      .single()

    if (updateError) {
      error.value = updateError.message
      throw updateError
    }

    const { job_updates, ...rest } = parseSelectedJobRow(data)
    jobs.value = jobs.value.map((item) =>
      item.id === id ? withHistory(rest, job_updates) : item
    )
  }

  function parseJobUpdateRecord(val: unknown): JobUpdateRecord {
    if (!val || typeof val !== 'object') {
      throw new Error('Invalid RPC response: expected object')
    }
    const o = val as Record<string, unknown>
    if (
      typeof o.id !== 'string' ||
      typeof o.job_id !== 'string' ||
      typeof o.delta !== 'number' ||
      typeof o.created_at !== 'string'
    ) {
      throw new Error('Invalid RPC response: missing or invalid required fields')
    }
    return {
      id: o.id,
      job_id: o.job_id,
      delta: o.delta,
      update_type:
        o.update_type === 'delivery' ||
        o.update_type === 'production' ||
        o.update_type === 'failed_production'
          ? o.update_type
          : undefined,
      created_at: o.created_at,
      updated_by: o.updated_by != null ? String(o.updated_by) : null,
      note: o.note != null ? String(o.note) : null,
    }
  }

  async function addDelivery(id: string, delta: number, updatedBy?: string | null) {
    error.value = null
    const job = jobs.value.find((j) => j.id === id)
    if (!job) {
      throw new Error('Job not found')
    }
    if (delta <= 0) {
      throw new Error('Delta must be positive')
    }
    const totalProduced = job.parts_produced + (job.parts_overproduced ?? 0)
    const currentDelivered = job.delivered ?? 0
    const newDelivered = currentDelivered + delta
    if (newDelivered > totalProduced) {
      throw new Error('Delivered cannot exceed total parts produced')
    }
    const now = formatISO(new Date())

    const { data: rpcData, error: rpcError } = await supabase.rpc('add_delivery', {
      p_job_id: id,
      p_delta: delta,
      p_updated_by: updatedBy ?? null,
      p_created_at: now,
    })

    if (rpcError) {
      error.value = rpcError.message
      throw rpcError
    }

    const newHistoryRecord = parseJobUpdateRecord(rpcData)

    jobs.value = jobs.value.map((item) => {
      if (item.id !== id) return item
      return {
        ...item,
        delivered: newDelivered,
        updated_at: now,
        job_updates: [newHistoryRecord, ...item.job_updates],
      }
    })
  }

  async function addFailedProduction(id: string, delta: number, updatedBy?: string | null) {
    error.value = null
    const job = jobs.value.find((j) => j.id === id)
    if (!job) {
      throw new Error('Job not found')
    }
    if (delta <= 0) {
      throw new Error('Delta must be positive')
    }
    const now = formatISO(new Date())

    const { data: rpcData, error: rpcError } = await supabase.rpc('add_failed_production', {
      p_job_id: id,
      p_delta: delta,
      p_updated_by: updatedBy ?? null,
      p_created_at: now,
    })

    if (rpcError) {
      error.value = rpcError.message
      throw rpcError
    }

    const newHistoryRecord = parseJobUpdateRecord(rpcData)
    const newPartsFailed = (job.parts_failed ?? 0) + delta

    jobs.value = jobs.value.map((item) => {
      if (item.id !== id) return item
      return {
        ...item,
        parts_failed: newPartsFailed,
        updated_at: now,
        job_updates: [newHistoryRecord, ...item.job_updates],
      }
    })
  }

  return {
    jobs,
    loading,
    error,
    searchTerm,
    statusFilter,
    showArchived,
    filteredJobs,
    filteredMainListJobs,
    filteredArchivedJobs,
    fetchJobs,
    createJob,
    updateJob,
    archiveJob,
    deleteJob,
    addProduction,
    deleteHistoryItem,
    updateHistoryItem,
    updateJobNotes,
    addDelivery,
    addFailedProduction,
    mergeJobUpdate,
    setSearch,
    setStatus,
    toggleArchivedVisibility,
  }
})

