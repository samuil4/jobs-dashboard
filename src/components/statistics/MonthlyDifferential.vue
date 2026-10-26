<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MonthStat } from '../../types/statistics'
import {
  formatDelta,
  formatMonthLabel,
  formatNumber,
  formatPercentOrNew,
  trendClass,
} from '../../utils/statisticsFormat'

const props = defineProps<{
  months: MonthStat[]
  selectedMonthKey: string
  locale: string
}>()

const emit = defineEmits<{ selectMonth: [key: string] }>()

const { t } = useI18n()

const maxTotal = computed(() => Math.max(1, ...props.months.map((month) => month.total)))
const tableMonths = computed(() => [...props.months].reverse())

function barHeight(total: number): string {
  if (total <= 0) return '3px'
  return `${Math.max((total / maxTotal.value) * 100, 4)}%`
}

function chartLabel(month: MonthStat): string {
  return formatMonthLabel(month.date, props.locale, { month: 'short', year: '2-digit' })
}

function longLabel(month: MonthStat): string {
  return formatMonthLabel(month.date, props.locale, { month: 'long', year: 'numeric' })
}

function percentLabel(month: MonthStat): string {
  return formatPercentOrNew(
    month.percentPrevMonth,
    month.total,
    props.locale,
    t('statistics.newValue'),
    t('statistics.noChange'),
  )
}

function percentTrend(month: MonthStat): string {
  return month.percentPrevMonth === null
    ? trendClass(month.deltaPrevMonth)
    : trendClass(month.percentPrevMonth)
}

function barTitle(month: MonthStat): string {
  return t('statistics.chart.monthBar', {
    month: longLabel(month),
    count: formatNumber(month.total, props.locale, 0),
  })
}
</script>

<template>
  <div class="monthly-panel">
    <section class="card chart-card">
      <header class="card-header">
        <h2>{{ t('statistics.chart.monthlyTitle') }}</h2>
      </header>
      <div class="chart-scroller">
        <div class="chart" role="list" :aria-label="t('statistics.chart.monthlyTitle')">
          <div v-for="month in months" :key="month.key" class="chart-column" role="listitem">
            <span class="chart-value">{{ formatNumber(month.total, locale, 0) }}</span>
            <div class="chart-track">
              <button
                type="button"
                class="chart-bar"
                :class="{
                  'is-selected': month.key === selectedMonthKey,
                  'is-empty': month.total === 0,
                }"
                :style="{ height: barHeight(month.total) }"
                :title="barTitle(month)"
                :aria-label="barTitle(month)"
                @click="emit('selectMonth', month.key)"
              />
            </div>
            <span class="chart-label">{{ chartLabel(month) }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="card table-card">
      <header class="card-header table-header">
        <div>
          <h2>{{ t('statistics.monthlyTable.title') }}</h2>
          <p class="card-caption">{{ t('statistics.monthlyTable.caption') }}</p>
        </div>
      </header>
      <div class="table-wrap">
        <table class="stats-table">
          <thead>
            <tr>
              <th scope="col">{{ t('statistics.monthlyTable.month') }}</th>
              <th scope="col" class="num">{{ t('statistics.monthlyTable.delivered') }}</th>
              <th scope="col" class="num">{{ t('statistics.monthlyTable.difference') }}</th>
              <th scope="col" class="num">{{ t('statistics.monthlyTable.change') }}</th>
              <th scope="col" class="num">{{ t('statistics.summary.deliveries') }}</th>
              <th scope="col" class="num">{{ t('statistics.summary.jobs') }}</th>
              <th scope="col" class="num">{{ t('statistics.monthlyTable.cumulative') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="month in tableMonths"
              :key="month.key"
              :class="{ 'is-selected': month.key === selectedMonthKey }"
            >
              <th scope="row" class="month-cell">
                <button type="button" class="link-button" @click="emit('selectMonth', month.key)">
                  {{ longLabel(month) }}
                </button>
                <div class="row-sub">
                  {{ t('statistics.summary.activeDays') }}:
                  {{ formatNumber(month.activeDays, locale, 0) }}
                </div>
              </th>
              <td class="num">{{ formatNumber(month.total, locale, 0) }}</td>
              <td class="num" :class="trendClass(month.deltaPrevMonth)">
                {{ formatDelta(month.deltaPrevMonth, locale) }}
              </td>
              <td class="num" :class="percentTrend(month)">{{ percentLabel(month) }}</td>
              <td class="num">{{ formatNumber(month.deliveries, locale, 0) }}</td>
              <td class="num">{{ formatNumber(month.jobs, locale, 0) }}</td>
              <td class="num">{{ formatNumber(month.cumulative, locale, 0) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!months.length" class="empty-state">{{ t('statistics.monthlyTable.empty') }}</p>
    </section>
  </div>
</template>

<style scoped>
.monthly-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-header h2 {
  margin: 0;
  font-size: 18px;
}

.card-caption {
  margin: 4px 0 0;
  font-size: 13px;
  color: #6b7280;
}

.chart-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chart-scroller {
  overflow-x: auto;
  padding-bottom: 4px;
}

.chart {
  display: flex;
  align-items: stretch;
  gap: 8px;
  min-width: 100%;
  height: 230px;
}

.chart-column {
  flex: 1 1 0;
  min-width: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  height: 100%;
}

.chart-value {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
}

.chart-track {
  flex: 1 1 auto;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-height: 0;
  border-bottom: 1px solid #e5e7eb;
}

.chart-bar {
  width: min(30px, 90%);
  padding: 0;
  border: none;
  border-radius: 6px 6px 2px 2px;
  background: #93c5fd;
  cursor: pointer;
  transition: background 0.15s ease;
}

.chart-bar:hover {
  background: #60a5fa;
}

.chart-bar.is-selected {
  background: #2563eb;
}

.chart-bar.is-empty {
  background: #e5e7eb;
}

.chart-label {
  font-size: 11px;
  color: #6b7280;
  white-space: nowrap;
}

.table-card {
  padding: 0;
  overflow: hidden;
}

.table-header {
  padding: 20px 20px 12px;
}

.table-wrap {
  overflow-x: auto;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
}

.stats-table th,
.stats-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}

.stats-table thead th {
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6b7280;
  background: #f9fafb;
}

.stats-table tbody th {
  font-size: 14px;
  font-weight: 600;
}

.stats-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.stats-table tr.is-selected {
  background: #eff6ff;
}

.month-cell {
  min-width: 180px;
}

.link-button {
  border: none;
  background: transparent;
  padding: 0;
  font: inherit;
  color: #1d4ed8;
  cursor: pointer;
  text-align: left;
}

.link-button:hover {
  text-decoration: underline;
}

.row-sub {
  margin-top: 2px;
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
}

.is-positive {
  color: #047857;
}

.is-negative {
  color: #b91c1c;
}

.is-neutral {
  color: #4b5563;
}

.empty-state {
  margin: 0;
  padding: 24px;
  text-align: center;
  color: #6b7280;
}

@media (max-width: 768px) {
  .chart {
    height: 190px;
  }

  .chart-column {
    min-width: 38px;
  }
}
</style>
