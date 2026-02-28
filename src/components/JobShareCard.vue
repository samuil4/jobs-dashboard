<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { JobShareData } from '../types/job'

const props = defineProps<{
  job: JobShareData
}>()

defineEmits<{
  (e: 'copyLink'): void
}>()

const { t } = useI18n()

const totalProduced = computed(
  () => props.job.parts_produced + (props.job.parts_overproduced ?? 0)
)

const partsReadyForDelivery = computed(
  () => Math.max(0, totalProduced.value - (props.job.delivered ?? 0))
)
</script>

<template>
  <article class="job-share-card card">
    <header class="job-share-header">
      <h2>{{ job.name }}</h2>
    </header>

    <section class="job-share-body">
      <div class="stats">
        <div class="stat-item">
          <span class="label">{{ t('jobs.partsNeeded') }}:</span>
          <strong>{{ job.parts_needed }}</strong>
        </div>
        <div class="stat-item">
          <span class="label">{{ t('jobs.partsProduced') }}:</span>
          <strong>{{ totalProduced }}</strong>
        </div>
        <div class="stat-item">
          <span class="label">{{ t('jobs.partsReadyForDelivery') }}:</span>
          <strong>{{ partsReadyForDelivery }}</strong>
        </div>
      </div>

      <div class="share-link-row">
        <button class="btn btn-secondary" type="button" @click="$emit('copyLink')">
          {{ t('jobs.copyShareLink') }}
        </button>
      </div>
    </section>
  </article>
</template>

<style scoped>
.job-share-card {
  max-width: 420px;
}

.job-share-header h2 {
  margin: 0 0 20px;
  font-size: 20px;
  color: #1f2937;
}

.job-share-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid #e5e7eb;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.stat-item .label {
  font-size: 13px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 500;
}

.stat-item strong {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.share-link-row {
  display: flex;
  justify-content: flex-start;
}
</style>
