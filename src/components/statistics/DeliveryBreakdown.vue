<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { BreakdownRow } from '../../types/statistics'
import { formatNumber } from '../../utils/statisticsFormat'

defineProps<{
  jobs: BreakdownRow[]
  clients: BreakdownRow[]
  locale: string
}>()

const { t } = useI18n()

function shareWidth(share: number): string {
  return `${Math.min(Math.max(share, 0), 100)}%`
}
</script>

<template>
  <section class="breakdown-section">
    <h2 class="section-title">{{ t('statistics.breakdown.title') }}</h2>
    <div class="breakdown-grid">
      <section class="card table-card">
        <header class="card-header">
          <h3>{{ t('statistics.breakdown.jobsTitle') }}</h3>
        </header>
        <div class="table-wrap">
          <table class="breakdown-table">
            <thead>
              <tr>
                <th scope="col">{{ t('statistics.breakdown.job') }}</th>
                <th scope="col" class="num">{{ t('statistics.breakdown.delivered') }}</th>
                <th scope="col" class="share-col">{{ t('statistics.breakdown.share') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in jobs" :key="row.key">
                <th scope="row" class="label-cell">
                  <span class="row-label">{{ row.label }}</span>
                  <span v-if="row.secondaryLabel" class="row-sub">{{ row.secondaryLabel }}</span>
                </th>
                <td class="num">{{ formatNumber(row.total, locale, 0) }}</td>
                <td class="share-col">
                  <div class="share-cell">
                    <span class="share-value">{{ formatNumber(row.share, locale, 1) }}%</span>
                    <span class="share-track">
                      <span class="share-fill" :style="{ width: shareWidth(row.share) }" />
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!jobs.length" class="empty-state">{{ t('statistics.breakdown.empty') }}</p>
      </section>

      <section class="card table-card">
        <header class="card-header">
          <h3>{{ t('statistics.breakdown.clientsTitle') }}</h3>
        </header>
        <div class="table-wrap">
          <table class="breakdown-table">
            <thead>
              <tr>
                <th scope="col">{{ t('statistics.breakdown.client') }}</th>
                <th scope="col" class="num">{{ t('statistics.breakdown.delivered') }}</th>
                <th scope="col" class="share-col">{{ t('statistics.breakdown.share') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in clients" :key="row.key">
                <th scope="row" class="label-cell">
                  <span class="row-label">{{ row.label }}</span>
                  <span v-if="row.secondaryLabel" class="row-sub">{{ row.secondaryLabel }}</span>
                </th>
                <td class="num">{{ formatNumber(row.total, locale, 0) }}</td>
                <td class="share-col">
                  <div class="share-cell">
                    <span class="share-value">{{ formatNumber(row.share, locale, 1) }}%</span>
                    <span class="share-track">
                      <span class="share-fill" :style="{ width: shareWidth(row.share) }" />
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!clients.length" class="empty-state">{{ t('statistics.breakdown.empty') }}</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.breakdown-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  margin: 0;
  font-size: 18px;
}

.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.table-card {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.card-header {
  padding: 20px 20px 12px;
}

.card-header h3 {
  margin: 0;
  font-size: 16px;
}

.table-wrap {
  overflow-x: auto;
}

.breakdown-table {
  width: 100%;
  border-collapse: collapse;
}

.breakdown-table th,
.breakdown-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: middle;
}

.breakdown-table thead th {
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6b7280;
  background: #f9fafb;
}

.breakdown-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.share-col {
  width: 40%;
  min-width: 130px;
}

.label-cell {
  font-size: 14px;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-label {
  color: #111827;
  overflow-wrap: anywhere;
}

.row-sub {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
}

.share-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.share-value {
  min-width: 48px;
  text-align: right;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: #374151;
}

.share-track {
  flex: 1 1 auto;
  height: 6px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
}

.share-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: #2563eb;
}

.empty-state {
  margin: 0;
  padding: 24px;
  text-align: center;
  color: #6b7280;
}
</style>
