import type { JobWithHistory } from '../types/job'

export const UNASSIGNED_KEY = '__unassigned__'

export interface ClientGroup {
  key: string
  label: string
  jobs: JobWithHistory[]
}

export function groupJobsByClient(
  jobs: JobWithHistory[],
  labelForFirstJob: (job: JobWithHistory, key: string) => string,
): Map<string, ClientGroup> {
  const map = new Map<string, ClientGroup>()
  for (const job of jobs) {
    const key = job.client_id ?? UNASSIGNED_KEY
    if (!map.has(key)) {
      map.set(key, { key, label: labelForFirstJob(job, key), jobs: [] })
    }
    map.get(key)!.jobs.push(job)
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
