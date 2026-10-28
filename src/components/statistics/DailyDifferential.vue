<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DayStat } from '../../types/statistics'
import {
  formatDayLabel,
  formatDayNumber,
  formatDelta,
  formatNumber,
  formatPercentOrNew,
  trendClass,
} from '../../utils/statisticsFormat'

const props = defineProps<{
  days: DayStat[]
  locale: string
}>()

const { t } = useI18n()
const showAllDays = ref(false)

const maxTotal = computed(() => Math.max(1, ...props.days.map((day) => day.total)))
const monthTotal = computed(() => props.days.reduce((sum, day) => sum + day.total, 0))
const monthDeliveries = computed(() => props.days.reduce((sum, day) => sum + day.deliveries, 0))
const visibleDays = computed(() => {
  const selected = showAllDays.value ? props.days : props.days.filter((day) => day.total > 0)
  return [...selected].reverse()
})

function barHeight(total: number): string {
  if (total <= 0) return '3px'
  return `${Math.max((total / maxTotal.value) * 100, 4)}%`
}

function barTitle(day: DayStat): string {
  return t('statistics.chart.dayBar', {
    day: formatDayLabel(day.date, props.locale),
    count: formatNumber(day.total, props.locale, 0),
  })
}

function percentLabel(day: DayStat): string {
  return formatPercentOrNew(
    day.percentPrevDay,
    day.total,
    props.locale,
    t('statistics.newValue'),
    t('statistics.noChange'),
  )
}

function percentTrend(day: DayStat): string {
  return day.percentPrevDay === null
    ? trendClass(day.deltaPrevDay)
    : trendClass(day.percentPrevDay)
}
</script>

<template>
  <div class="daily-panel">
    <section class="card chart-card">
      <header class="card-header">
        <h2>{{ t('statistics.chart.dailyTitle') }}</h2>
      </header>
      <div class="chart-scroller">
        <div class="chart" role="list" :aria-label="t('statistics.chart.dailyTitle')">
          <div v-for="day in days" :key="day.key" class="chart-column" role="listitem">
            <div class="chart-track">
              <span
                class="chart-bar"
                role="img"
                :class="{
                  'is-peak': day.total > 0 && day.total === maxTotal,
                  'is-empty': day.total === 0,
                }"
                :style="{ height: barHeight(day.total) }"
                :title="barTitle(day)"
                :aria-label="barTitle(day)"
              />
            </div>
            <span class="chart-label">{{ formatDayNumber(day.date, locale) }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="card table-card">
      <header class="card-header table-header">
        <div>
          <h2>{{ t('statistics.dailyTable.title') }}</h2>
          <p class="card-caption">{{ t('statistics.dailyTable.caption') }}</p>
        </div>
        <label class="toggle">
          <input v-model="showAllDays" type="checkbox" />
          <span>{{ t('statistics.dailyTable.showAllDays') }}</span>
        </label>
      </header>
      <div class="table-wrap">
        <table class="stats-table">
          <thead>
            <tr>
              <th scope="col">{{ t('statistics.dailyTable.day') }}</th>
              <th scope="col" class="num">{{ t('statistics.dailyTable.delivered') }}</th>
              <th scope="col" class="num">{{ t('statistics.dailyTable.difference') }}</th>
              <th scope="col" class="num">{{ t('statistics.dailyTable.change') }}</th>
              <th scope="col" class="num">{{ t('statistics.summary.deliveries') }}</th>
              <th scope="col" class="num">{{ t('statistics.dailyTable.cumulative') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="day in visibleDays" :key="day.key">
              <th scope="row" class="day-cell">{{ formatDayLabel(day.date, locale) }}</th>
              <td class="num">{{ formatNumber(day.total, locale, 0) }}</td>
              <td class="num" :class="trendClass(day.deltaPrevDay)">
                {{ formatDelta(day.deltaPrevDay, locale) }}
              </td>
              <td class="num" :class="percentTrend(day)">{{ percentLabel(day) }}</td>
              <td class="num">{{ formatNumber(day.deliveries, locale, 0) }}</td>
              <td class="num">{{ formatNumber(day.cumulative, locale, 0) }}</td>
            </tr>
          </tbody>
          <tfoot v-if="days.length">
            <tr>
              <th scope="row">{{ t('statistics.dailyTable.monthTotal') }}</th>
              <td class="num">{{ formatNumber(monthTotal, locale, 0) }}</td>
              <td class="num" />
              <td class="num" />
              <td class="num">{{ formatNumber(monthDeliveries, locale, 0) }}</td>
              <td class="num">{{ formatNumber(monthTotal, locale, 0) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p v-if="!days.length" class="empty-state">{{ t('statistics.dailyTable.empty') }}</p>
      <p v-else-if="!visibleDays.length" class="empty-state">
        {{ t('statistics.dailyTable.empty') }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.daily-panel {
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
  gap: 4px;
  min-width: 100%;
  height: 170px;
}

.chart-column {
  flex: 1 1 0;
  min-width: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  height: 100%;
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
  width: 100%;
  max-width: 20px;
  padding: 0;
  border: none;
  border-radius: 4px 4px 2px 2px;
  background: #6ee7b7;
  cursor: default;
  transition: background 0.15s ease;
}

.chart-bar:hover {
  background: #34d399;
}

.chart-bar.is-peak {
  background: #059669;
}

.chart-bar.is-empty {
  background: #e5e7eb;
}

.chart-label {
  font-size: 10px;
  color: #6b7280;
}

.table-card {
  padding: 0;
  overflow: hidden;
}

.table-header {
  padding: 20px 20px 12px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  white-space: nowrap;
}

.toggle input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: #2563eb;
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

.stats-table tfoot th,
.stats-table tfoot td {
  font-weight: 700;
  background: #f9fafb;
  border-bottom: none;
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

.day-cell {
  min-width: 140px;
  text-transform: capitalize;
}

.empty-state {
  margin: 0;
  padding: 24px;
  text-align: center;
  color: #6b7280;
}

@media (max-width: 768px) {
  .table-header {
    flex-direction: column;
  }

  .chart {
    height: 140px;
  }
}
</style>
