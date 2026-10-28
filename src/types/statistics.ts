export interface StatisticsClientRef {
  id: string
  username: string
  company_name: string
}

export interface StatisticsJobRef {
  id: string
  name: string
  purchase_order: string | null
  invoice: string | null
  archived: boolean
  client: StatisticsClientRef | null
}

/** Raw PostgREST shapes can return embedded relations as objects or arrays. */
export interface StatisticsJobRefRaw extends Omit<StatisticsJobRef, 'client'> {
  client?: StatisticsClientRef | StatisticsClientRef[] | null
}

export interface DeliveryUpdateRowRaw {
  id: string
  job_id: string
  delta: number
  created_at: string
  job?: StatisticsJobRefRaw | StatisticsJobRefRaw[] | null
}

/** A `job_updates` row of type `delivery`, enriched with its parent job. */
export interface DeliveryUpdateRow {
  id: string
  job_id: string
  delta: number
  created_at: string
  job: StatisticsJobRef | null
}

export interface MonthStat {
  /** Local month key, `yyyy-MM`. */
  key: string
  /** First day of the month at local midnight. */
  date: Date
  total: number
  deliveries: number
  jobs: number
  activeDays: number
  deltaPrevMonth: number
  /** Percent change vs the previous month; null when the previous month is 0. */
  percentPrevMonth: number | null
  cumulative: number
}

export interface DayStat {
  /** Local day key, `yyyy-MM-dd`. */
  key: string
  date: Date
  total: number
  deliveries: number
  jobs: number
  deltaPrevDay: number
  /** Percent change vs the previous day; null when the previous day is 0. */
  percentPrevDay: number | null
  cumulative: number
}

export interface MonthSummary {
  key: string
  date: Date
  total: number
  previousTotal: number
  delta: number
  percent: number | null
  deliveries: number
  jobs: number
  activeDays: number
  averagePerActiveDay: number
  bestDay: DayStat | null
}

export interface BreakdownRow {
  key: string
  label: string
  secondaryLabel: string | null
  total: number
  deliveries: number
  /** Share of the selected month total, in percent. */
  share: number
}
