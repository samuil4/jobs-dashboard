import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { formatISO } from 'date-fns'

import { supabase } from '../lib/supabase'
import type {
  Assignee,
  JobRecord,
  JobUpdateRecord,
  JobWithHistory,
  NewJobPayload,
  UpdateJobPayload,
} from '../types/job'

export const ASSIGNEE_OPTIONS: Assignee[] = ['Samuil', 'Oleksii', 'Veselin']
export const DEFAULT_ASSIGNEE: Assignee = ASSIGNEE_OPTIONS[0]!

type StatusFilter = 'all' | 'active' | 'completed' | 'archived'

export const useJobsStore = defineStore('jobs', () => {
  const jobs = ref<JobWithHistory[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchTerm = ref('')
  const statusFilter = ref<StatusFilter>('all')
  const showArchived = ref(false)

  function withHistory(job: JobRecord, history: JobUpdateRecord[] | null): JobWithHistory {
    return {
      ...job,
      job_updates: history?.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ) ?? [],
    }
  }

  async function fetchJobs() {
    loading.value = true
    error.value = null
    const { data, error: fetchError } = await supabase
      .from('jobs')
      .select('id, name, parts_needed, parts_produced, parts_overproduced, notes, delivered, archived, status, assignee, created_at, updated_at, job_updates (*)')
      .order('created_at', { ascending: false })

    if (fetchError) {
      error.value = fetchError.message
      loading.value = false
      return
    }

    jobs.value =
      data?.map((item) => {
        const { job_updates, ...rest } = item as JobRecord & { job_updates: JobUpdateRecord[] | null }
        return withHistory(rest, job_updates)
      }) ?? []

    loading.value = false
  }

  async function createJob(payload: NewJobPayload) {
    error.value = null
    const now = formatISO(new Date())
    const { data, error: insertError } = await supabase
      .from('jobs')
      .insert({
        name: payload.name,
        parts_needed: payload.partsNeeded,
        parts_produced: 0,
        parts_overproduced: 0,
        notes: null,
        delivered: 0,
        archived: false,
        status: 'active',
        assignee: payload.assignee,
        created_at: now,
        updated_at: now,
      })
      .select('id, name, parts_needed, parts_produced, parts_overproduced, notes, delivered, archived, status, assignee, created_at, updated_at, job_updates (*)')
      .single()

    if (insertError) {
      error.value = insertError.message
      throw insertError
    }

    const { job_updates, ...rest } = data as JobRecord & { job_updates: JobUpdateRecord[] | null }
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

    const { data, error: updateError } = await supabase
      .from('jobs')
      .update({
        name: payload.name,
        parts_needed: payload.partsNeeded,
        parts_produced: newPartsProduced,
        parts_overproduced: newPartsOverproduced,
        assignee: payload.assignee,
        status: job.archived ? 'archived' : newStatus,
        updated_at: formatISO(new Date()),
      })
      .eq('id', id)
      .select('id, name, parts_needed, parts_produced, parts_overproduced, notes, delivered, archived, status, assignee, created_at, updated_at, job_updates (*)')
      .single()

    if (updateError) {
      error.value = updateError.message
      throw updateError
    }

    const { job_updates, ...rest } = data as JobRecord & { job_updates: JobUpdateRecord[] | null }
    jobs.value = jobs.value.map((item) => (item.id === id ? withHistory(rest, job_updates) : item))
  }

  async function archiveJob(id: string, archivedValue: boolean) {
    error.value = null
    const job = jobs.value.find((j) => j.id === id)
    if (!job) return

    const status = archivedValue
      ? ('archived' as const)
      : job.parts_produced >= job.parts_needed
        ? ('completed' as const)
        : ('active' as const)

    const { data, error: updateError } = await supabase
      .from('jobs')
      .update({
        archived: archivedValue,
        status,
        updated_at: formatISO(new Date()),
      })
      .eq('id', id)
      .select('id, name, parts_needed, parts_produced, parts_overproduced, notes, delivered, archived, status, assignee, created_at, updated_at, job_updates (*)')
      .single()

    if (updateError) {
      error.value = updateError.message
      throw updateError
    }

    const { job_updates, ...rest } = data as JobRecord & { job_updates: JobUpdateRecord[] | null }
    jobs.value = jobs.value.map((item) => (item.id === id ? withHistory(rest, job_updates) : item))
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

    const { error: jobUpdateError } = await supabase
      .from('jobs')
      .update({
        parts_produced: newPartsProduced,
        parts_overproduced: newPartsOverproduced,
        status: job.archived ? 'archived' : status,
        updated_at: now,
      })
      .eq('id', id)

    if (jobUpdateError) {
      error.value = jobUpdateError.message
      throw jobUpdateError
    }

    // Store the full delta in history (including overproduction)
    const { data: historyInsert, error: historyError } = await supabase
      .from('job_updates')
      .insert({
        job_id: id,
        delta: delta,
        update_type: 'production',
        updated_by: updatedBy ?? null,
        created_at: now,
      })
      .select()
      .single()

    if (historyError) {
      error.value = historyError.message
      throw historyError
    }

    const newHistoryRecord = historyInsert as JobUpdateRecord

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

  const filteredJobs = computed(() => {
    const query = searchTerm.value.trim().toLowerCase()
    return jobs.value.filter((job) => {
      if (!showArchived.value && job.archived && statusFilter.value !== 'archived') {
        return false
      }

      if (statusFilter.value !== 'all' && job.status !== statusFilter.value) {
        return false
      }

      if (!query) return true
      return (
        job.name.toLowerCase().includes(query) ||
        job.assignee.toLowerCase().includes(query)
      )
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

  function recalculateJobProduction(
    historyEntries: JobUpdateRecord[],
    job: JobRecord
  ): {
    parts_produced: number
    parts_overproduced: number
    status: 'active' | 'completed' | 'archived'
  } {
    // Sum deltas from production entries only (exclude delivery)
    const totalProduced = historyEntries
      .filter((e) => e.update_type !== 'delivery')
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
        .select('id, name, parts_needed, parts_produced, parts_overproduced, notes, delivered, archived, status, assignee, created_at, updated_at, job_updates (*)')
        .single()

      if (updateError) {
        error.value = updateError.message
        throw updateError
      }

      const { job_updates, ...rest } = updatedJob as JobRecord & { job_updates: JobUpdateRecord[] | null }
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
        .select('id, name, parts_needed, parts_produced, parts_overproduced, notes, delivered, archived, status, assignee, created_at, updated_at, job_updates (*)')
        .single()

      if (updateError) {
        error.value = updateError.message
        throw updateError
      }

      const { job_updates, ...rest } = updatedJob as JobRecord & { job_updates: JobUpdateRecord[] | null }
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
        .select('id, name, parts_needed, parts_produced, parts_overproduced, notes, delivered, archived, status, assignee, created_at, updated_at, job_updates (*)')
        .single()

      if (jobUpdateError) {
        error.value = jobUpdateError.message
        throw jobUpdateError
      }

      const { job_updates, ...rest } = updatedJob as JobRecord & { job_updates: JobUpdateRecord[] | null }
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
        .select('id, name, parts_needed, parts_produced, parts_overproduced, notes, delivered, archived, status, assignee, created_at, updated_at, job_updates (*)')
        .single()

      if (jobUpdateError) {
        error.value = jobUpdateError.message
        throw jobUpdateError
      }

      const { job_updates, ...rest } = updatedJob as JobRecord & { job_updates: JobUpdateRecord[] | null }
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
      .select('id, name, parts_needed, parts_produced, parts_overproduced, notes, delivered, archived, status, assignee, created_at, updated_at, job_updates (*)')
      .single()

    if (updateError) {
      error.value = updateError.message
      throw updateError
    }

    const { job_updates, ...rest } = data as JobRecord & { job_updates: JobUpdateRecord[] | null }
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
        o.update_type === 'delivery' || o.update_type === 'production'
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

  return {
    jobs,
    loading,
    error,
    searchTerm,
    statusFilter,
    showArchived,
    filteredJobs,
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
    setSearch,
    setStatus,
    toggleArchivedVisibility,
  }
})

