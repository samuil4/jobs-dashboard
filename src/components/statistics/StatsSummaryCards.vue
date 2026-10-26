<script setup lang="ts">
import { computed } from 'vue'
import { subMonths } from 'date-fns'
import { useI18n } from 'vue-i18n'

import type { MonthSummary } from '../../types/statistics'
import {
  formatDayLabel,
  formatDelta,
  formatMonthLabel,
  formatNumber,
  formatPercentOrNew,
  trendClass,
} from '../../utils/statisticsFormat'

const props = defineProps<{
  summary: MonthSummary
  locale: string
}>()

const { t } = useI18n()

const monthLabel = computed(() =>
  formatMonthLabel(props.summary.date, props.locale, { month: 'long', year: 'numeric' }),
)
const previousMonthLabel = computed(() =>
  formatMonthLabel(subMonths(props.summary.date, 1), props.locale, {
    month: 'long',
    year: 'numeric',
  }),
)
const percentLabel = computed(() =>
  formatPercentOrNew(
    props.summary.percent,
    props.summary.total,
    props.locale,
    t('statistics.newValue'),
    t('statistics.noChange'),
  ),
)
const deltaTrend = computed(() => trendClass(props.summary.delta))
const percentTrend = computed(() =>
  props.summary.percent === null
    ? trendClass(props.summary.delta)
    : trendClass(props.summary.percent),
)
const bestDayLabel = computed(() =>
  props.summary.bestDay
    ? `${formatDayLabel(props.summary.bestDay.date, props.locale)} · ${formatNumber(
        props.summary.bestDay.total,
        props.locale,
        0,
      )}`
    : t('statistics.noChange'),
)
</script>

<template>
  <div class="summary-grid">
    <article class="card summary-card summary-card-primary">
      <span class="summary-label">{{ t('statistics.summary.monthTotal', { month: monthLabel }) }}</span>
      <span class="summary-value">{{ formatNumber(summary.total, locale, 0) }}</span>
      <span class="summary-hint">
        {{ t('statistics.summary.bestDay') }}: {{ bestDayLabel }}
      </span>
    </article>

    <article class="card summary-card">
      <span class="summary-label">{{ t('statistics.summary.previousMonth') }}</span>
      <span class="summary-value">{{ formatNumber(summary.previousTotal, locale, 0) }}</span>
      <span class="summary-hint">{{ previousMonthLabel }}</span>
    </article>

    <article class="card summary-card" :class="deltaTrend">
      <span class="summary-label">{{ t('statistics.summary.difference') }}</span>
      <span class="summary-value">{{ formatDelta(summary.delta, locale) }}</span>
      <span class="summary-hint">{{ t('statistics.summary.deliveries') }}: {{ formatNumber(summary.deliveries, locale, 0) }}</span>
    </article>

    <article class="card summary-card" :class="percentTrend">
      <span class="summary-label">{{ t('statistics.summary.change') }}</span>
      <span class="summary-value">{{ percentLabel }}</span>
      <span class="summary-hint">{{ t('statistics.summary.jobs') }}: {{ formatNumber(summary.jobs, locale, 0) }}</span>
    </article>

    <article class="card summary-card">
      <span class="summary-label">{{ t('statistics.summary.activeDays') }}</span>
      <span class="summary-value">{{ formatNumber(summary.activeDays, locale, 0) }}</span>
    </article>

    <article class="card summary-card">
      <span class="summary-label">{{ t('statistics.summary.averagePerActiveDay') }}</span>
      <span class="summary-value">{{ formatNumber(summary.averagePerActiveDay, locale, 1) }}</span>
    </article>
  </div>
</template>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px;
  border-top: 4px solid transparent;
}

.summary-card-primary {
  border-top-color: #2563eb;
  background: linear-gradient(180deg, #eff6ff 0%, #fff 100%);
}

.summary-card.is-positive {
  border-top-color: #059669;
}

.summary-card.is-negative {
  border-top-color: #dc2626;
}

.summary-card.is-neutral {
  border-top-color: #9ca3af;
}

.summary-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6b7280;
}

.summary-value {
  font-size: 30px;
  line-height: 1.1;
  font-weight: 700;
  color: #111827;
}

.summary-hint {
  font-size: 13px;
  color: #6b7280;
}

.is-positive .summary-value {
  color: #047857;
}

.is-negative .summary-value {
  color: #b91c1c;
}
</style>
