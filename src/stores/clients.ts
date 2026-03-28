import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { createClientAccount, deleteClientAccount, updateClientAccount } from '../lib/clientAdminApi'
import { supabase } from '../lib/supabase'
import type { ClientFormPayload, ClientRecord, ClientSummary } from '../types/client'

interface ClientJobMetricsRow {
  client_id: string | null
  archived: boolean
  status: 'active' | 'completed' | 'archived'
  parts_produced: number
  parts_overproduced: number
}

export const useClientsStore = defineStore('clients', () => {
  const clients = ref<ClientSummary[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  function buildSummaries(clientRows: ClientRecord[], jobRows: ClientJobMetricsRow[]): ClientSummary[] {
    const byClient = new Map<string, ClientJobMetricsRow[]>()

    for (const job of jobRows) {
      if (!job.client_id) continue
      const list = byClient.get(job.client_id) ?? []
      list.push(job)
      byClient.set(job.client_id, list)
    }

    return clientRows.map((client) => {
      const clientJobs = byClient.get(client.id) ?? []
      const completedJobs = clientJobs.filter((job) => job.status === 'completed' || job.archived).length
      const jobsInProduction = clientJobs.filter(
        (job) =>
          !job.archived &&
          job.status === 'active' &&
          job.parts_produced + (job.parts_overproduced ?? 0) > 0
      ).length
      const unstartedJobs = clientJobs.filter(
        (job) =>
          !job.archived &&
          job.status === 'active' &&
          job.parts_produced + (job.parts_overproduced ?? 0) === 0
      ).length

      return {
        ...client,
        completed_jobs: completedJobs,
        jobs_in_production: jobsInProduction,
        unstarted_jobs: unstartedJobs,
      }
    })
  }

  async function fetchClients() {
    loading.value = true
    error.value = null

    const [{ data: clientRows, error: clientsError }, { data: jobRows, error: jobsError }] = await Promise.all([
      supabase.from('clients').select('id, auth_user_id, username, company_name, created_at, updated_at').order('company_name'),
      supabase
        .from('jobs')
        .select('client_id, archived, status, parts_produced, parts_overproduced'),
    ])

    if (clientsError) {
      error.value = clientsError.message
      loading.value = false
      return
    }

    if (jobsError) {
      error.value = jobsError.message
      loading.value = false
      return
    }

    clients.value = buildSummaries(
      (clientRows ?? []) as ClientRecord[],
      (jobRows ?? []) as ClientJobMetricsRow[]
    )
    loading.value = false
  }

  async function createClient(payload: ClientFormPayload) {
    error.value = null
    const result = await createClientAccount(payload)
    if (result.error) {
      error.value = result.error
      throw new Error(result.error)
    }
    await fetchClients()
  }

  async function updateClient(id: string, payload: ClientFormPayload) {
    error.value = null
    const result = await updateClientAccount(id, payload)
    if (result.error) {
      error.value = result.error
      throw new Error(result.error)
    }
    await fetchClients()
  }

  async function deleteClient(id: string) {
    error.value = null
    const result = await deleteClientAccount(id)
    if (result.error) {
      error.value = result.error
      throw new Error(result.error)
    }
    clients.value = clients.value.filter((client) => client.id !== id)
  }

  const clientOptions = computed(() =>
    clients.value.map((client) => ({
      id: client.id,
      label: client.company_name,
      username: client.username,
    }))
  )

  return {
    clients,
    loading,
    error,
    clientOptions,
    fetchClients,
    createClient,
    updateClient,
    deleteClient,
  }
})
