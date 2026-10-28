/** Number/date formatting helpers shared by the statistics module. */

export function formatNumber(value: number, locale: string, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)
}

/** Signed integer/delta, e.g. `+12`, `-5`, `0`. */
export function formatDelta(value: number, locale: string): string {
  if (value === 0) return formatNumber(0, locale, 0)
  const formatted = formatNumber(Math.abs(value), locale, 1)
  return `${value > 0 ? '+' : '-'}${formatted}`
}

export function formatPercent(value: number, locale: string): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${formatNumber(Math.abs(value), locale, 1)}%`
}

/**
 * Percent change label with explicit empty-baseline handling:
 * `null` means the previous period was 0, so a positive current value is "new".
 */
export function formatPercentOrNew(
  percent: number | null,
  current: number,
  locale: string,
  newLabel: string,
  emptyLabel: string,
): string {
  if (percent === null) return current > 0 ? newLabel : emptyLabel
  return formatPercent(percent, locale)
}

export function formatMonthLabel(
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' },
): string {
  return new Intl.DateTimeFormat(locale, options).format(date)
}

export function formatDayLabel(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

export function formatDayNumber(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(date)
}

export function trendClass(value: number): 'is-positive' | 'is-negative' | 'is-neutral' {
  if (value > 0) return 'is-positive'
  if (value < 0) return 'is-negative'
  return 'is-neutral'
}
