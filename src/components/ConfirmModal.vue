<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  show: boolean
  title: string
  description: string
  confirmLabel?: string
  confirmVariant?: 'primary' | 'danger' | 'secondary'
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()

const confirmClass = computed(() => {
  switch (props.confirmVariant) {
    case 'danger':
      return 'btn btn-danger'
    case 'secondary':
      return 'btn btn-secondary'
    default:
      return 'btn btn-primary'
  }
})
</script>

<template>
  <div v-if="show" class="overlay" role="dialog" aria-modal="true">
    <div class="modal confirm-modal">
      <header class="modal-header">
        <h2>{{ title }}</h2>
        <button class="btn btn-ghost" type="button" @click="emit('cancel')">
          {{ t('common.close') }}
        </button>
      </header>

      <p class="confirm-text">
        {{ description }}
      </p>

      <footer class="modal-footer">
        <button class="btn btn-secondary" type="button" @click="emit('cancel')">
          {{ t('common.cancel') }}
        </button>
        <button :class="confirmClass" type="button" @click="emit('confirm')">
          {{ confirmLabel ?? t('common.confirm') }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.confirm-modal {
  max-width: 480px;
}

.confirm-text {
  margin: 0;
  font-size: 15px;
  color: #374151;
  line-height: 1.6;
}
</style>

