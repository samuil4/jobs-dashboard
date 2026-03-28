import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { supabase } from '../lib/supabase'
import type { ClientJobRecord } from '../types/client'

const CLIENT_JOB_FIELDS =
  'id, name, parts_needed, parts_produced, parts_overproduced, delivered, archived, status, updated_at'

export const useClientPortalStore = defineStore('clientPortal', () => {
  const jobs = ref<ClientJobRecord[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchTerm = ref('')
  const showArchived = ref(false)

  async function fetchJobs(clientId: string, includeArchived = showArchived.value) {
    loading.value = true
    error.value = null

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
      loading.value = false
      return
    }

    jobs.value = (data ?? []) as ClientJobRecord[]
    showArchived.value = includeArchived
    loading.value = false
  }

  async function toggleArchived(clientId: string) {
    await fetchJobs(clientId, !showArchived.value)
  }

  const filteredJobs = computed(() => {
    const query = searchTerm.value.trim().toLowerCase()
    if (!query) return jobs.value
    return jobs.value.filter((job) => job.name?.toLowerCase().includes(query))
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
  }
})
