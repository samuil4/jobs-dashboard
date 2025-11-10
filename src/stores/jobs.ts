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
      .select('id, name, parts_needed, parts_produced, archived, status, assignee, created_at, updated_at, job_updates (*)')
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
        archived: false,
        status: 'active',
        assignee: payload.assignee,
        created_at: now,
        updated_at: now,
      })
      .select('id, name, parts_needed, parts_produced, archived, status, assignee, created_at, updated_at, job_updates (*)')
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

    const newStatus =
      job.parts_produced >= payload.partsNeeded ? ('completed' as const) : ('active' as const)

    const { data, error: updateError } = await supabase
      .from('jobs')
      .update({
        name: payload.name,
        parts_needed: payload.partsNeeded,
        assignee: payload.assignee,
        status: job.archived ? 'archived' : newStatus,
        updated_at: formatISO(new Date()),
      })
      .eq('id', id)
      .select('id, name, parts_needed, parts_produced, archived, status, assignee, created_at, updated_at, job_updates (*)')
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
      .select('id, name, parts_needed, parts_produced, archived, status, assignee, created_at, updated_at, job_updates (*)')
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

    const remainingBefore = Math.max(job.parts_needed - job.parts_produced, 0)
    const appliedDelta = Math.min(delta, remainingBefore)
    if (appliedDelta <= 0) {
      return
    }
    const targetTotal = job.parts_produced + appliedDelta
    const cappedTotal = Math.min(targetTotal, job.parts_needed)
    const status = cappedTotal >= job.parts_needed ? ('completed' as const) : ('active' as const)
    const now = formatISO(new Date())

    const { error: jobUpdateError } = await supabase
      .from('jobs')
      .update({
        parts_produced: cappedTotal,
        status: job.archived ? 'archived' : status,
        updated_at: now,
      })
      .eq('id', id)

    if (jobUpdateError) {
      error.value = jobUpdateError.message
      throw jobUpdateError
    }

    const { data: historyInsert, error: historyError } = await supabase
      .from('job_updates')
      .insert({
        job_id: id,
        delta: appliedDelta,
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
        parts_produced: cappedTotal,
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
    setSearch,
    setStatus,
    toggleArchivedVisibility,
  }
})

