<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { addMonths, differenceInCalendarMonths, subMonths } from 'date-fns'
import { useI18n } from 'vue-i18n'

import DailyDifferential from '../components/statistics/DailyDifferential.vue'
import DeliveryBreakdown from '../components/statistics/DeliveryBreakdown.vue'
import MonthlyDifferential from '../components/statistics/MonthlyDifferential.vue'
import StatsSummaryCards from '../components/statistics/StatsSummaryCards.vue'
import { useStatisticsStore } from '../stores/statistics'
import {
  buildClientBreakdown,
  buildDailyStats,
  buildJobBreakdown,
  buildMonthSummary,
  buildMonthlyStats,
  getMonthRows,
  monthKey,
  monthKeyToDate,
} from '../utils/deliveryStats'
import { formatMonthLabel } from '../utils/statisticsFormat'

type ViewMode = 'month' | 'day'

const statisticsStore = useStatisticsStore()
const { t, locale } = useI18n()

const today = new Date()
const maxMonthKey = monthKey(today)
/** Delivery history is fetched for 24 months plus one baseline month. */
const minMonthKey = monthKey(subMonths(today, 23))

const selectedMonthKey = ref(maxMonthKey)
const viewMode = ref<ViewMode>('month')
const monthRange = ref(12)
const selectedClientId = ref('all')
const monthRangeOptions = [6, 12, 24]
let initialMonthApplied = false

const selectedMonthDate = computed(() => monthKeyToDate(selectedMonthKey.value) ?? new Date())

const monthInput = computed({
  get: () => selectedMonthKey.value,
  set: (value: string) => selectMonth(value),
})

const clientOptions = computed(() => {
  const clients = new Map<string, string>()
  for (const row of statisticsStore.updates) {
    const client = row.job?.client
    if (!client) continue
    clients.set(client.id, client.company_name || client.username)
  }
  return [...clients.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((left, right) => left.label.localeCompare(right.label))
})

const filteredUpdates = computed(() => {
  if (selectedClientId.value === 'all') return statisticsStore.updates
  return statisticsStore.updates.filter((row) => row.job?.client?.id === selectedClientId.value)
})

const monthlyStats = computed(() =>
  buildMonthlyStats(filteredUpdates.value, monthRange.value, today),
)
const monthRows = computed(() => getMonthRows(filteredUpdates.value, selectedMonthKey.value))
const dailyStats = computed(() => buildDailyStats(filteredUpdates.value, selectedMonthDate.value))
const monthSummary = computed(() => buildMonthSummary(filteredUpdates.value, selectedMonthDate.value))
const jobBreakdown = computed(() => buildJobBreakdown(monthRows.value, t('statistics.unknownJob')))
const clientBreakdown = computed(() =>
  buildClientBreakdown(monthRows.value, t('statistics.unassignedClient')),
)
const hasUpdates = computed(() => statisticsStore.updates.length > 0)

function adjacentMonthLabel(offset: number): string {
  return formatMonthLabel(addMonths(selectedMonthDate.value, offset), locale.value, {
    month: 'long',
    year: 'numeric',
  })
}

function monthsAgo(key: string): number {
  const date = monthKeyToDate(key)
  return date ? differenceInCalendarMonths(today, date) : 0
}

function clampMonthKey(key: string): string {
  if (key < minMonthKey) return minMonthKey
  if (key > maxMonthKey) return maxMonthKey
  return key
}

function shiftMonth(offset: number): void {
  selectMonth(monthKey(addMonths(selectedMonthDate.value, offset)))
}

function ensureRangeCoversSelection(): void {
  if (monthsAgo(selectedMonthKey.value) >= monthRange.value) monthRange.value = 24
}

function selectMonth(key: string): void {
  if (!monthKeyToDate(key)) return
  selectedMonthKey.value = clampMonthKey(key)
  ensureRangeCoversSelection()
}

function openMonth(key: string): void {
  selectMonth(key)
  viewMode.value = 'day'
}

/** On first load, jump to the latest month that actually has deliveries. */
function applyInitialMonth(): void {
  if (initialMonthApplied) return
  // Wait for a successful, non-empty load so a later refresh can still apply the initial month.
  if (statisticsStore.error || statisticsStore.updates.length === 0) return
  initialMonthApplied = true
  if (getMonthRows(statisticsStore.updates, selectedMonthKey.value).length > 0) return
  const latest = [...buildMonthlyStats(statisticsStore.updates, 24, today)]
    .reverse()
    .find((month) => month.total > 0)
  if (latest) {
    selectedMonthKey.value = latest.key
    ensureRangeCoversSelection()
  }
}

async function refresh(): Promise<void> {
  await statisticsStore.refresh()
  applyInitialMonth()
}

onMounted(async () => {
  await statisticsStore.fetchDeliveryUpdates()
  applyInitialMonth()
})
</script>

<template>
  <section class="statistics-page">
    <div class="page-header">
      <div>
        <h1>{{ t('statistics.heading') }}</h1>
        <p class="page-subtitle">{{ t('statistics.subtitle') }}</p>
      </div>
      <button
        class="btn btn-secondary"
        :class="{ 'is-loading': statisticsStore.loading }"
        type="button"
        :disabled="statisticsStore.loading"
        @click="refresh"
      >
        {{ t('statistics.refresh') }}
      </button>
    </div>

    <div class="card controls">
      <div class="control">
        <label for="stats-month">{{ t('statistics.filters.month') }}</label>
        <div class="month-nav">
          <button
            class="nav-button"
            type="button"
            :aria-label="adjacentMonthLabel(-1)"
            :title="adjacentMonthLabel(-1)"
            :disabled="selectedMonthKey <= minMonthKey"
            @click="shiftMonth(-1)"
          >
            ‹
          </button>
          <input
            id="stats-month"
            v-model="monthInput"
            class="month-input"
            type="month"
            :min="minMonthKey"
            :max="maxMonthKey"
          />
          <button
            class="nav-button"
            type="button"
            :aria-label="adjacentMonthLabel(1)"
            :title="adjacentMonthLabel(1)"
            :disabled="selectedMonthKey >= maxMonthKey"
            @click="shiftMonth(1)"
          >
            ›
          </button>
        </div>
      </div>

      <div class="control">
        <label for="stats-client">{{ t('statistics.filters.client') }}</label>
        <select id="stats-client" v-model="selectedClientId">
          <option value="all">{{ t('statistics.filters.allClients') }}</option>
          <option v-for="client in clientOptions" :key="client.id" :value="client.id">
            {{ client.label }}
          </option>
        </select>
      </div>

      <div class="control">
        <label for="stats-range">{{ t('statistics.filters.range') }}</label>
        <select id="stats-range" v-model.number="monthRange">
          <option v-for="option in monthRangeOptions" :key="option" :value="option">
            {{ t('statistics.rangeMonths', { count: option }) }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="statisticsStore.error" class="card state error">
      <p class="state-message">{{ t('statistics.loadError') }}</p>
      <p class="state-detail">{{ statisticsStore.error }}</p>
      <button
        class="btn btn-primary"
        type="button"
        :disabled="statisticsStore.loading"
        @click="refresh"
      >
        {{ t('statistics.retry') }}
      </button>
    </div>

    <div v-else-if="statisticsStore.loading && !hasUpdates" class="card state">
      {{ t('common.loading') }}…
    </div>

    <div v-else-if="!hasUpdates" class="card state">{{ t('statistics.empty') }}</div>

    <template v-else>
      <StatsSummaryCards :summary="monthSummary" :locale="locale" />

      <div class="tabs" role="tablist" :aria-label="t('statistics.heading')">
        <button
          class="tab"
          :class="{ 'is-active': viewMode === 'month' }"
          type="button"
          role="tab"
          :aria-selected="viewMode === 'month'"
          @click="viewMode = 'month'"
        >
          {{ t('statistics.tabs.byMonth') }}
        </button>
        <button
          class="tab"
          :class="{ 'is-active': viewMode === 'day' }"
          type="button"
          role="tab"
          :aria-selected="viewMode === 'day'"
          @click="viewMode = 'day'"
        >
          {{ t('statistics.tabs.byDay') }}
        </button>
      </div>

      <div class="tab-panel" role="tabpanel">
        <MonthlyDifferential
          v-if="viewMode === 'month'"
          :months="monthlyStats"
          :selected-month-key="selectedMonthKey"
          :locale="locale"
          @select-month="openMonth"
        />
        <DailyDifferential v-else :days="dailyStats" :locale="locale" />
      </div>

      <DeliveryBreakdown :jobs="jobBreakdown" :clients="clientBreakdown" :locale="locale" />
    </template>
  </section>
</template>

<style scoped>
.statistics-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-header h1 {
  margin: 0;
  font-size: 28px;
}

.page-subtitle {
  margin: 6px 0 0;
  color: #6b7280;
}

.controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 16px;
  padding: 20px;
}

.control label {
  margin-bottom: 6px;
}

.control input,
.control select {
  margin: 0;
}

.month-nav {
  display: flex;
  align-items: stretch;
  gap: 6px;
}

.month-input {
  flex: 1 1 auto;
  min-width: 0;
}

.nav-button {
  flex: 0 0 auto;
  width: 40px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  background: #f9fafb;
  color: #1f2933;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.nav-button:hover {
  background: #eef2f7;
}

.nav-button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.state {
  text-align: center;
  padding: 32px;
  font-size: 16px;
}

.state.error {
  color: #b91c1c;
}

.state-message {
  margin: 0 0 8px;
  font-weight: 600;
}

.state-detail {
  margin: 0 0 16px;
  font-size: 13px;
  color: #6b7280;
  overflow-wrap: anywhere;
}

.tabs {
  display: inline-flex;
  align-self: flex-start;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: #e5e7eb;
}

.tab {
  border: none;
  background: transparent;
  border-radius: 999px;
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 600;
  color: #4b5563;
  cursor: pointer;
}

.tab:hover {
  color: #111827;
}

.tab.is-active {
  background: #fff;
  color: #1d4ed8;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.15);
}

.tab-panel {
  display: flex;
  flex-direction: column;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
  }
}
</style>
