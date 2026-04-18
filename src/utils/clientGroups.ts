import type { JobWithHistory } from '../types/job'

export const UNASSIGNED_KEY = '__unassigned__'

/** Sentinel key for jobs with no purchase order (grouped together, listed last). */
export const NO_PO_KEY = '__no_po__'

export interface PurchaseOrderSubgroup {
  key: string
  /** First-seen trimmed PO text (user casing); empty when `key === NO_PO_KEY` — use i18n in UI. */
  headerPoLabel: string
  jobs: JobWithHistory[]
}

/**
 * Buckets jobs by trimmed PO, case-insensitive key; no-PO bucket last; within each bucket, newest `created_at` first.
 */
export function subgroupJobsByPurchaseOrder(jobs: JobWithHistory[]): PurchaseOrderSubgroup[] {
  const buckets = new Map<string, JobWithHistory[]>()
  const poDisplay = new Map<string, string>()
  const insertOrder: string[] = []

  for (const job of jobs) {
    const trimmed = job.purchase_order?.trim() ?? ''
    const key = trimmed ? trimmed.toLowerCase() : NO_PO_KEY
    if (!buckets.has(key)) {
      buckets.set(key, [])
      insertOrder.push(key)
      if (key !== NO_PO_KEY) {
        poDisplay.set(key, trimmed)
      }
    }
    buckets.get(key)!.push(job)
  }

  const poKeys = insertOrder.filter((k) => k !== NO_PO_KEY).sort((a, b) => a.localeCompare(b))
  const orderedKeys = [...poKeys]
  if (insertOrder.includes(NO_PO_KEY)) {
    orderedKeys.push(NO_PO_KEY)
  }

  return orderedKeys.map((key) => {
    const list = buckets.get(key)!
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const headerPoLabel = key === NO_PO_KEY ? '' : (poDisplay.get(key) ?? key)
    return { key, headerPoLabel, jobs: list }
  })
}

export interface ClientGroup {
  key: string
  label: string
  jobs: JobWithHistory[]
}

export function groupJobsByClient(
  jobs: JobWithHistory[],
  resolveLabel: (job: JobWithHistory, key: string) => string,
): Map<string, ClientGroup> {
  const map = new Map<string, ClientGroup>()
  for (const job of jobs) {
    const key = job.client_id ?? UNASSIGNED_KEY
    const group = map.get(key)
    if (!group) {
      map.set(key, { key, label: resolveLabel(job, key), jobs: [job] })
    } else {
      group.jobs.push(job)
      if (key !== UNASSIGNED_KEY && job.client?.company_name) {
        group.label = resolveLabel(job, key)
      }
    }
  }
  return map
}

export function defaultKeyOrder(groups: Map<string, ClientGroup>): string[] {
  const keys = [...groups.keys()]
  const unassigned = keys.filter((k) => k === UNASSIGNED_KEY)
  const rest = keys.filter((k) => k !== UNASSIGNED_KEY)
  rest.sort((a, b) =>
    groups.get(a)!.label.localeCompare(groups.get(b)!.label, undefined, { sensitivity: 'base' }),
  )
  return [...rest, ...unassigned]
}

/** Apply saved key order; unknown keys get default sort (A–Z, unassigned last). */
export function mergeOrder(savedKeys: string[], groups: Map<string, ClientGroup>): string[] {
  const present = new Set(groups.keys())
  const result: string[] = []
  const used = new Set<string>()
  for (const k of savedKeys) {
    if (present.has(k) && !used.has(k)) {
      result.push(k)
      used.add(k)
    }
  }
  const missing = [...present].filter((k) => !used.has(k))
  if (missing.length === 0) return result
  const subMap = new Map<string, ClientGroup>()
  for (const k of missing) {
    subMap.set(k, groups.get(k)!)
  }
  for (const k of defaultKeyOrder(subMap)) {
    result.push(k)
  }
  return result
}

export function swapKeysInOrder(order: string[], a: string, b: string): string[] {
  const i = order.indexOf(a)
  const j = order.indexOf(b)
  if (i === -1 || j === -1) return order
  const next = [...order]
  const tmp = next[i]!
  next[i] = next[j]!
  next[j] = tmp
  return next
}
