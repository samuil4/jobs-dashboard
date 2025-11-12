<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  show: boolean
  currentDelta: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', newDelta: number): void
}>()

const { t } = useI18n()

const form = reactive({
  delta: props.currentDelta,
  touched: false,
})

watch(
  () => props.currentDelta,
  (value) => {
    form.delta = value
    form.touched = false
  },
  { immediate: true }
)

watch(
  () => props.show,
  (show) => {
    if (show) {
      form.delta = props.currentDelta
      form.touched = false
    }
  }
)

function handleClose() {
  emit('close')
}

function validate() {
  return form.delta > 0
}

function handleSubmit() {
  form.touched = true
  if (!validate()) return

  emit('save', Number(form.delta))
}
</script>

<template>
  <div v-if="show" class="overlay" role="dialog" aria-modal="true">
    <div class="modal">
      <header class="modal-header">
        <h2>{{ t('jobs.history.editTitle') }}</h2>
        <button class="btn btn-ghost" type="button" @click="handleClose">
          {{ t('common.close') }}
        </button>
      </header>

      <form class="form" @submit.prevent="handleSubmit">
        <div>
          <label for="history-delta">{{ t('jobs.history.deltaLabel') }}</label>
          <input
            id="history-delta"
            v-model.number="form.delta"
            type="number"
            min="1"
            :class="{ invalid: form.touched && (!form.delta || form.delta <= 0) }"
            required
          />
          <p v-if="form.touched && (!form.delta || form.delta <= 0)" class="error">
            {{ t('common.invalidNumber') }}
          </p>
        </div>

        <footer class="modal-footer">
          <button class="btn btn-secondary" type="button" @click="handleClose">
            {{ t('common.cancel') }}
          </button>
          <button class="btn btn-primary" type="submit">
            {{ t('jobs.history.save') }}
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
</style>

