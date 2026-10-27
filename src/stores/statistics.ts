import { defineStore } from 'pinia'
import { ref } from 'vue'
import { startOfMonth, subMonths } from 'date-fns'

import { supabase } from '../lib/supabase'
import type {
  DeliveryUpdateRow,
  DeliveryUpdateRowRaw,
  StatisticsClientRef,
  StatisticsJobRef,
  StatisticsJobRefRaw,
} from '../types/statistics'
import { normalizeDeliveryRows, STATISTICS_FETCH_MONTHS } from '../utils/deliveryStats'

/** PostgREST caps a single response at 1000 rows unless configured otherwise. */
const PAGE_SIZE = 1000
const MAX_PAGES = 25
const FETCH_LIMIT_ERROR = `Delivery history exceeds ${MAX_PAGES * PAGE_SIZE} rows, so statistics were not loaded.`

const DELIVERY_SELECT_FIELDS =
  'id, job_id, delta, created_at, job:jobs(id, name, purchase_order, invoice, archived, client:clients(id, username, company_name))'

function pickFirst<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeClient(
  client: StatisticsClientRef | StatisticsClientRef[] | null | undefined,
): StatisticsClientRef | null {
  const picked = pickFirst(client)
  return picked
    ? {
        id: picked.id,
        username: picked.username,
        company_name: picked.company_name ?? '',
      }
    : null
}

function normalizeJob(job: DeliveryUpdateRowRaw['job']): StatisticsJobRef | null {
  const picked = pickFirst(job) as StatisticsJobRefRaw | null
  if (!picked) return null
  return {
    id: picked.id,
    name: picked.name ?? '',
    purchase_order: picked.purchase_order ?? null,
    invoice: picked.invoice ?? null,
    archived: Boolean(picked.archived),
    client: normalizeClient(picked.client),
  }
}

function normalizeDeliveryRow(raw: DeliveryUpdateRowRaw): DeliveryUpdateRow {
  return {
    id: raw.id,
    job_id: raw.job_id,
    delta: Number(raw.delta ?? 0),
    created_at: raw.created_at,
    job: normalizeJob(raw.job),
  }
}

export const useStatisticsStore = defineStore('statistics', () => {
  const updates = ref<DeliveryUpdateRow[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastFetchedAt = ref<string | null>(null)
  let fetchInFlight: Promise<void> | null = null

  async function loadDeliveryUpdates(months: number): Promise<void> {
    loading.value = true
    error.value = null
    const span = Math.max(1, Math.floor(months))
    const from = startOfMonth(subMonths(new Date(), span - 1)).toISOString()
    const collected = new Map<string, DeliveryUpdateRow>()
    let reachedEnd = false

    try {
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const offset = page * PAGE_SIZE
        const { data, error: fetchError } = await supabase
          .from('job_updates')
          .select(DELIVERY_SELECT_FIELDS)
          .eq('update_type', 'delivery')
          .gte('created_at', from)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)

        if (fetchError) {
          error.value = fetchError.message
          return
        }

        const pageRows = (data ?? []) as unknown as DeliveryUpdateRowRaw[]
        // Offset pagination can repeat rows when records are inserted between page requests.
        for (const raw of pageRows) {
          const row = normalizeDeliveryRow(raw)
          collected.set(row.id, row)
        }
        if (pageRows.length < PAGE_SIZE) {
          reachedEnd = true
          break
        }
      }

      if (!reachedEnd) {
        // The last allowed page was full, so more rows may exist: do not publish partial data.
        error.value = FETCH_LIMIT_ERROR
        return
      }

      updates.value = normalizeDeliveryRows([...collected.values()])
      lastFetchedAt.value = new Date().toISOString()
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  async function fetchDeliveryUpdates(months = STATISTICS_FETCH_MONTHS): Promise<void> {
    if (fetchInFlight) return fetchInFlight
    fetchInFlight = loadDeliveryUpdates(months).finally(() => {
      fetchInFlight = null
    })
    return fetchInFlight
  }

  function refresh(): Promise<void> {
    return fetchDeliveryUpdates()
  }

  function reset(): void {
    updates.value = []
    error.value = null
    lastFetchedAt.value = null
  }

  return {
    updates,
    loading,
    error,
    lastFetchedAt,
    fetchDeliveryUpdates,
    refresh,
    reset,
  }
})
