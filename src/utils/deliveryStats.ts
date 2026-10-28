import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns'

import type {
  BreakdownRow,
  DayStat,
  DeliveryUpdateRow,
  MonthStat,
  MonthSummary,
} from '../types/statistics'

export const MONTH_KEY_FORMAT = 'yyyy-MM'
export const DAY_KEY_FORMAT = 'yyyy-MM-dd'
export const DEFAULT_MONTHS_BACK = 24
/** One extra month is fetched so the oldest visible month still has a baseline. */
export const STATISTICS_FETCH_MONTHS = DEFAULT_MONTHS_BACK + 1

interface Bucket {
  total: number
  deliveries: number
  jobs: Set<string>
  days: Set<string>
}

function createBucket(): Bucket {
  return { total: 0, deliveries: 0, jobs: new Set<string>(), days: new Set<string>() }
}

function toLocalDate(iso: string): Date | null {
  if (!iso) return null
  const parsed = parseISO(iso)
  return isValid(parsed) ? parsed : null
}

export function monthKey(date: Date): string {
  return format(date, MONTH_KEY_FORMAT)
}

export function dayKey(date: Date): string {
  return format(date, DAY_KEY_FORMAT)
}

/** Parse a `yyyy-MM` key into the first day of that month at local midnight. */
export function monthKeyToDate(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }
  return new Date(year, month - 1, 1)
}

/** Ascending list of month keys ending with the reference month. */
export function listMonthKeys(monthsBack = DEFAULT_MONTHS_BACK, reference = new Date()): string[] {
  const count = Math.max(1, Math.floor(monthsBack))
  const end = startOfMonth(reference)
  const keys: string[] = []
  for (let index = count - 1; index >= 0; index -= 1) {
    keys.push(monthKey(subMonths(end, index)))
  }
  return keys
}

/** Keep only delivery rows with a valid date and a positive delta. */
export function normalizeDeliveryRows(rows: DeliveryUpdateRow[]): DeliveryUpdateRow[] {
  return rows.filter((row) => {
    if (!Number.isFinite(row.delta) || row.delta <= 0) return false
    return toLocalDate(row.created_at) !== null
  })
}

function bucketize(rows: DeliveryUpdateRow[], keyOf: (date: Date) => string): Map<string, Bucket> {
  const buckets = new Map<string, Bucket>()
  for (const row of rows) {
    const date = toLocalDate(row.created_at)
    if (!date) continue
    const key = keyOf(date)
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = createBucket()
      buckets.set(key, bucket)
    }
    bucket.total += row.delta
    bucket.deliveries += 1
    bucket.jobs.add(row.job_id)
    bucket.days.add(dayKey(date))
  }
  return buckets
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

/** Delivery rows that belong to the given local month key. */
export function getMonthRows(rows: DeliveryUpdateRow[], key: string): DeliveryUpdateRow[] {
  return normalizeDeliveryRows(rows).filter((row) => {
    const date = toLocalDate(row.created_at)
    return date !== null && monthKey(date) === key
  })
}

/**
 * Zero-filled monthly series ending at `reference`.
 * `deltaPrevMonth` of the first month compares against the month before the range
 * (available when the store fetched the extra baseline month, otherwise 0).
 */
export function buildMonthlyStats(
  rows: DeliveryUpdateRow[],
  monthsBack = DEFAULT_MONTHS_BACK,
  reference = new Date(),
): MonthStat[] {
  const normalized = normalizeDeliveryRows(rows)
  const keys = listMonthKeys(monthsBack, reference)
  const firstKey = keys[0]
  const firstDate = firstKey ? monthKeyToDate(firstKey) : null
  const baselineKey = monthKey(subMonths(firstDate ?? startOfMonth(reference), 1))
  const buckets = bucketize(normalized, (date) => monthKey(date))
  const stats: MonthStat[] = []
  let cumulative = 0

  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]!
    const bucket = buckets.get(key)
    const previousKey = index === 0 ? baselineKey : keys[index - 1]!
    const previousTotal = buckets.get(previousKey)?.total ?? 0
    const total = bucket?.total ?? 0
    cumulative += total
    stats.push({
      key,
      date: monthKeyToDate(key) ?? startOfMonth(reference),
      total,
      deliveries: bucket?.deliveries ?? 0,
      jobs: bucket?.jobs.size ?? 0,
      activeDays: bucket?.days.size ?? 0,
      deltaPrevMonth: total - previousTotal,
      percentPrevMonth: percentChange(total, previousTotal),
      cumulative,
    })
  }

  return stats
}

/** Zero-filled daily series for the month of `monthDate` (day 1 compares with the previous month's last day). */
export function buildDailyStats(rows: DeliveryUpdateRow[], monthDate: Date): DayStat[] {
  const normalized = normalizeDeliveryRows(rows)
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const buckets = bucketize(normalized, (date) => dayKey(date))
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const previousDayBucket = buckets.get(dayKey(subDays(monthStart, 1)))
  let previousTotal = previousDayBucket?.total ?? 0
  let cumulative = 0

  return days.map((date) => {
    const key = dayKey(date)
    const bucket = buckets.get(key)
    const total = bucket?.total ?? 0
    cumulative += total
    const stat: DayStat = {
      key,
      date,
      total,
      deliveries: bucket?.deliveries ?? 0,
      jobs: bucket?.jobs.size ?? 0,
      deltaPrevDay: total - previousTotal,
      percentPrevDay: percentChange(total, previousTotal),
      cumulative,
    }
    previousTotal = total
    return stat
  })
}

export function buildMonthSummary(rows: DeliveryUpdateRow[], monthDate: Date): MonthSummary {
  const normalized = normalizeDeliveryRows(rows)
  const key = monthKey(monthDate)
  const previousKey = monthKey(subMonths(startOfMonth(monthDate), 1))
  const buckets = bucketize(normalized, (date) => monthKey(date))
  const current = buckets.get(key)
  const total = current?.total ?? 0
  const previousTotal = buckets.get(previousKey)?.total ?? 0
  const activeDays = current?.days.size ?? 0
  const bestDay = buildDailyStats(normalized, monthDate).reduce<DayStat | null>((best, day) => {
    if (day.total <= 0) return best
    if (!best || day.total > best.total) return day
    return best
  }, null)

  return {
    key,
    date: startOfMonth(monthDate),
    total,
    previousTotal,
    delta: total - previousTotal,
    percent: percentChange(total, previousTotal),
    deliveries: current?.deliveries ?? 0,
    jobs: current?.jobs.size ?? 0,
    activeDays,
    averagePerActiveDay: activeDays > 0 ? total / activeDays : 0,
    bestDay,
  }
}

interface BreakdownGroup {
  label: string
  secondaryLabel: string | null
  total: number
  deliveries: number
}

function toBreakdownRows(groups: Map<string, BreakdownGroup>): BreakdownRow[] {
  const total = [...groups.values()].reduce((sum, group) => sum + group.total, 0)
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: group.label,
      secondaryLabel: group.secondaryLabel,
      total: group.total,
      deliveries: group.deliveries,
      share: total > 0 ? (group.total / total) * 100 : 0,
    }))
    .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label))
}

export function buildJobBreakdown(
  rows: DeliveryUpdateRow[],
  unknownJobLabel = '—',
): BreakdownRow[] {
  const groups = new Map<string, BreakdownGroup>()
  for (const row of normalizeDeliveryRows(rows)) {
    const key = row.job?.id ?? `unknown:${row.job_id}`
    const client = row.job?.client ?? null
    const existing = groups.get(key)
    if (existing) {
      existing.total += row.delta
      existing.deliveries += 1
      continue
    }
    groups.set(key, {
      label: row.job?.name.trim() || unknownJobLabel,
      secondaryLabel: client ? client.company_name || client.username : null,
      total: row.delta,
      deliveries: 1,
    })
  }
  return toBreakdownRows(groups)
}

export function buildClientBreakdown(
  rows: DeliveryUpdateRow[],
  unassignedLabel = '—',
): BreakdownRow[] {
  const groups = new Map<string, BreakdownGroup>()
  for (const row of normalizeDeliveryRows(rows)) {
    const client = row.job?.client ?? null
    const key = client?.id ?? 'unassigned'
    const existing = groups.get(key)
    if (existing) {
      existing.total += row.delta
      existing.deliveries += 1
      continue
    }
    groups.set(key, {
      label: client ? client.company_name || client.username : unassignedLabel,
      secondaryLabel: client ? client.username : null,
      total: row.delta,
      deliveries: 1,
    })
  }
  return toBreakdownRows(groups)
}
