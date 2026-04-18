<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import { ASSIGNEE_OPTIONS, DEFAULT_ASSIGNEE, JOB_PRIORITY_OPTIONS, DEFAULT_JOB_PRIORITY } from '../../stores/jobs'
import { useClientsStore } from '../../stores/clients'
import type { Assignee, JobPriority } from '../../types/job'

const props = defineProps<{
  show: boolean
  mode: 'create' | 'edit'
  submitting?: boolean
  initialValues?: {
    name: string
    partsNeeded: number
    assignee: Assignee
    priority: JobPriority
    clientId?: string | null
    sharePassword?: string | null
    hasSharePassword?: boolean
    purchaseOrder?: string | null
    invoice?: string | null
  }
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (
    e: 'submit',
    payload: {
      name: string
      partsNeeded: number
      assignee: Assignee
      priority: JobPriority
      clientId?: string | null
      sharePassword?: string | null
      purchaseOrder?: string | null
      invoice?: string | null
    }
  ): void
}>()

const { t } = useI18n()
const clientsStore = useClientsStore()
const { clientOptions } = storeToRefs(clientsStore)

const form = reactive({
  name: '',
  partsNeeded: 0,
  assignee: DEFAULT_ASSIGNEE,
  priority: DEFAULT_JOB_PRIORITY as JobPriority,
  clientId: '',
  sharePassword: '',
  purchaseOrder: '',
  invoice: '',
  touched: false,
})

watch(
  () => props.initialValues,
  (values) => {
    if (!values) {
      form.name = ''
      form.partsNeeded = 0
      form.assignee = DEFAULT_ASSIGNEE
      form.priority = DEFAULT_JOB_PRIORITY
      form.clientId = ''
      form.sharePassword = ''
      form.purchaseOrder = ''
      form.invoice = ''
      return
    }
    form.name = values.name
    form.partsNeeded = values.partsNeeded
    form.assignee = values.assignee
    form.priority = values.priority
    form.clientId = values.clientId ?? ''
    form.sharePassword = values.sharePassword ?? ''
    form.purchaseOrder = values.purchaseOrder ?? ''
    form.invoice = values.invoice ?? ''
  },
  { immediate: true }
)

const title = computed(() =>
  props.mode === 'create' ? t('jobs.addJob') : t('jobs.editJob')
)

const submitLabel = computed(() =>
  props.mode === 'create' ? t('jobs.addJob') : t('common.save')
)

function handleClose() {
  if (props.submitting) return
  emit('close')
}

function validate() {
  if (!form.name.trim()) return false
  if (!form.partsNeeded || form.partsNeeded <= 0) return false
  if (!ASSIGNEE_OPTIONS.includes(form.assignee)) return false
  return true
}

function generateSharePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  form.sharePassword = result
}

function handleSubmit() {
  if (props.submitting) return
  form.touched = true
  if (!validate()) return

  emit('submit', {
    name: form.name.trim(),
    partsNeeded: Number(form.partsNeeded),
    assignee: form.assignee,
    priority: form.priority,
    clientId: form.clientId || null,
    sharePassword: form.sharePassword.trim() || null,
    purchaseOrder: form.purchaseOrder.trim() || null,
    invoice: form.invoice.trim() || null,
  })
}
</script>

<template>
  <div v-if="show" class="overlay" role="dialog" aria-modal="true">
    <div class="modal">
      <header class="modal-header">
        <h2>{{ title }}</h2>
        <button class="btn btn-ghost" type="button" :disabled="submitting" @click="handleClose">
          {{ t('common.close') }}
        </button>
      </header>

      <form class="form" @submit.prevent="handleSubmit">
        <div>
          <label for="job-name">{{ t('jobs.jobName') }}</label>
          <input
            id="job-name"
            v-model="form.name"
            type="text"
            :disabled="submitting"
            :class="{ invalid: form.touched && !form.name }"
            required
          />
          <p v-if="form.touched && !form.name" class="error">
            {{ t('common.required') }}
          </p>
        </div>

        <div>
          <label for="job-purchase-order">{{ t('jobs.purchaseOrder') }}</label>
          <input
            id="job-purchase-order"
            v-model="form.purchaseOrder"
            type="text"
            :disabled="submitting"
            :placeholder="t('jobs.purchaseOrderPlaceholder')"
            autocomplete="off"
          />
        </div>

        <div>
          <label for="job-invoice">{{ t('jobs.invoice') }}</label>
          <input
            id="job-invoice"
            v-model="form.invoice"
            type="text"
            :disabled="submitting"
            :placeholder="t('jobs.invoicePlaceholder')"
            autocomplete="off"
          />
        </div>

        <div>
          <label for="job-parts">{{ t('jobs.partsNeeded') }}</label>
          <input
            id="job-parts"
            v-model.number="form.partsNeeded"
            type="number"
            min="1"
            :disabled="submitting"
            :class="{ invalid: form.touched && (!form.partsNeeded || form.partsNeeded <= 0) }"
            required
          />
          <p v-if="form.touched && (!form.partsNeeded || form.partsNeeded <= 0)" class="error">
            {{ t('common.invalidNumber') }}
          </p>
        </div>

        <div>
          <label for="job-assignee">{{ t('jobs.assignee') }}</label>
          <select
            id="job-assignee"
            v-model="form.assignee"
            :disabled="submitting"
            :class="{ invalid: form.touched && !ASSIGNEE_OPTIONS.includes(form.assignee) }"
          >
            <option v-for="assignee in ASSIGNEE_OPTIONS" :key="assignee" :value="assignee">
              {{ t(`jobs.assignees.${assignee.toLowerCase()}`) }}
            </option>
          </select>
        </div>

        <div>
          <label for="job-priority">{{ t('jobs.priority.label') }}</label>
          <select id="job-priority" v-model="form.priority" :disabled="submitting">
            <option v-for="p in JOB_PRIORITY_OPTIONS" :key="p" :value="p">
              {{ t(`jobs.priority.${p}`) }}
            </option>
          </select>
        </div>

        <div>
          <label for="job-client">{{ t('jobs.client') }}</label>
          <select id="job-client" v-model="form.clientId" :disabled="submitting">
            <option value="">{{ t('jobs.clientUnassigned') }}</option>
            <option v-for="client in clientOptions" :key="client.id" :value="client.id">
              {{ client.label }} ({{ client.username }})
            </option>
          </select>
        </div>

        <div>
          <div class="share-password-label-row">
            <label for="job-share-password">{{ t('jobs.sharePassword') }}</label>
            <span
              v-if="props.mode === 'edit' && props.initialValues?.hasSharePassword"
              class="password-set-badge"
            >
              {{ t('jobs.sharePasswordSet') }}
            </span>
          </div>
          <div class="share-password-row">
            <input
              id="job-share-password"
              v-model="form.sharePassword"
              type="text"
              :disabled="submitting"
              :placeholder="
                props.mode === 'edit' && props.initialValues?.hasSharePassword
                  ? t('jobs.sharePasswordReplacePlaceholder')
                  : t('jobs.sharePasswordPlaceholder')
              "
              autocomplete="off"
            />
            <button class="btn btn-secondary" type="button" :disabled="submitting" @click="generateSharePassword">
              {{ t('jobs.sharePasswordGenerate') }}
            </button>
          </div>
          <p v-if="props.mode === 'edit' && props.initialValues?.hasSharePassword" class="hint">
            {{ t('jobs.sharePasswordKeepHint') }}
          </p>
        </div>

        <footer class="modal-footer">
          <button class="btn btn-secondary" type="button" :disabled="submitting" @click="handleClose">
            {{ t('common.cancel') }}
          </button>
          <button
            class="btn btn-primary"
            :class="{ 'is-loading': submitting }"
            type="submit"
            :disabled="submitting"
          >
            {{ submitting ? t('common.saving') : submitLabel }}
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error {
  font-size: 12px;
  color: #dc2626;
  margin: 4px 0 0;
}

.invalid {
  border-color: #dc2626;
}

.share-password-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.password-set-badge {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #16a34a;
  background: #dcfce7;
  padding: 2px 8px;
  border-radius: 4px;
}

.share-password-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.share-password-row input {
  flex: 1;
}

.hint {
  font-size: 12px;
  color: #6b7280;
  margin: 4px 0 0;
}
</style>

