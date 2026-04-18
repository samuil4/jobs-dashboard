import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { supabase } from '../lib/supabase'
import type { ClientJobRecord } from '../types/client'
import type { JobUpdateRecord, UpdateType } from '../types/job'

const CLIENT_JOB_FIELDS =
  'id, name, purchase_order, invoice, parts_needed, parts_produced, parts_overproduced, delivered, archived, status, priority, created_at, updated_at'

export const useClientPortalStore = defineStore('clientPortal', () => {
  const jobs = ref<ClientJobRecord[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchTerm = ref('')
  const showArchived = ref(false)
  const activeClientId = ref<string | null>(null)
  let channel: ReturnType<typeof supabase.channel> | null = null

  async function fetchJobs(clientId: string, includeArchived = showArchived.value) {
    loading.value = true
    error.value = null
    jobs.value = []
    activeClientId.value = null

    let query = supabase
      .from('jobs')
      .select(CLIENT_JOB_FIELDS)
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false })

    if (!includeArchived) {
      query = query.eq('archived', false)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      error.value = fetchError.message
      jobs.value = []
      showArchived.value = false
      loading.value = false
      return
    }

    jobs.value = (data ?? []).map((row) => ({
      ...(row as ClientJobRecord),
      purchase_order: (row as { purchase_order?: string | null }).purchase_order ?? null,
      invoice: (row as { invoice?: string | null }).invoice ?? null,
      created_at: (row as { created_at?: string }).created_at ?? '',
    }))
    showArchived.value = includeArchived
    activeClientId.value = clientId
    loading.value = false
  }

  function mergeJobUpdate(update: JobUpdateRecord) {
    const displayedJobIds = new Set(jobs.value.map((job) => job.id))
    if (!displayedJobIds.has(update.job_id)) {
      return
    }

    jobs.value = jobs.value.map((job) => {
      if (job.id !== update.job_id) return job

      const updateType = (update.update_type ?? 'production') as UpdateType
      let partsProduced = job.parts_produced
      let partsOverproduced = job.parts_overproduced ?? 0
      let delivered = job.delivered ?? 0

      if (updateType === 'production') {
        const currentTotal = partsProduced + partsOverproduced
        const newTotal = currentTotal + update.delta
        partsProduced = Math.min(newTotal, job.parts_needed)
        partsOverproduced = Math.max(0, newTotal - job.parts_needed)
      } else if (updateType === 'delivery') {
        delivered += update.delta
      }

      return {
        ...job,
        parts_produced: partsProduced,
        parts_overproduced: partsOverproduced,
        delivered,
        status:
          job.archived
            ? 'archived'
            : partsProduced >= job.parts_needed
              ? 'completed'
              : 'active',
        updated_at: update.created_at,
      }
    })
  }

  function subscribe(clientId: string) {
    if (channel && activeClientId.value === clientId) return

    if (channel) {
      void channel.unsubscribe()
      supabase.removeChannel(channel)
      channel = null
    }

    channel = supabase
      .channel(`client-job-updates:${clientId}`)
      .on(
        'postgres_changes',
        {
          schema: 'public',
          table: 'job_updates',
          event: 'INSERT',
        },
        (payload) => {
          mergeJobUpdate(payload.new as JobUpdateRecord)
        }
      )
      .subscribe()

    activeClientId.value = clientId
  }

  function unsubscribe() {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
    jobs.value = []
    activeClientId.value = null
    showArchived.value = false
    error.value = null
  }

  async function toggleArchived(clientId: string) {
    await fetchJobs(clientId, !showArchived.value)
  }

  function statusSortRank(status: ClientJobRecord['status']) {
    if (status === 'active') return 0
    if (status === 'completed') return 1
    return 2
  }

  function prioritySortRank(priority: ClientJobRecord['priority']) {
    switch (priority) {
      case 'urgent':
        return 0
      case 'high':
        return 1
      case 'normal':
        return 2
      case 'low':
        return 3
      default:
        return 2
    }
  }

  const filteredJobs = computed(() => {
    const query = searchTerm.value.trim().toLowerCase()
    const list = !query
      ? [...jobs.value]
      : jobs.value.filter((job) => {
          const name = job.name?.toLowerCase() ?? ''
          const po = job.purchase_order?.trim().toLowerCase() ?? ''
          const inv = job.invoice?.trim().toLowerCase() ?? ''
          return (
            name.includes(query) ||
            (po.length > 0 && po.includes(query)) ||
            (inv.length > 0 && inv.includes(query))
          )
        })

    list.sort((a, b) => {
      const st = statusSortRank(a.status) - statusSortRank(b.status)
      if (st !== 0) return st

      if (a.status === 'active') {
        const pr = prioritySortRank(a.priority) - prioritySortRank(b.priority)
        if (pr !== 0) return pr
      }

      const ca = a.created_at ? new Date(a.created_at).getTime() : 0
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0
      return cb - ca
    })

    return list
  })

  return {
    jobs,
    loading,
    error,
    searchTerm,
    showArchived,
    filteredJobs,
    fetchJobs,
    toggleArchived,
    subscribe,
    unsubscribe,
  }
})
