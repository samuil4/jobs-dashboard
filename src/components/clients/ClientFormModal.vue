<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const USERNAME_REGEX = /^[A-Za-z0-9._-]{3,50}$/

const props = defineProps<{
  show: boolean
  mode: 'create' | 'edit'
  submitting?: boolean
  initialValues?: {
    username: string
    companyName: string
  }
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: { username: string; companyName: string; password?: string | null }): void
}>()

const { t } = useI18n()

const form = reactive({
  username: '',
  companyName: '',
  password: '',
  touched: false,
})

watch(
  () => props.initialValues,
  (values) => {
    if (!values) {
      form.username = ''
      form.companyName = ''
      form.password = ''
      form.touched = false
      return
    }
    form.username = values.username
    form.companyName = values.companyName
    form.password = ''
    form.touched = false
  },
  { immediate: true }
)

const title = computed(() =>
  props.mode === 'create' ? t('clients.addClient') : t('clients.editClient')
)

const submitLabel = computed(() =>
  props.mode === 'create' ? t('clients.addClient') : t('common.save')
)

const usernameInvalid = computed(() =>
  form.touched && !USERNAME_REGEX.test(form.username.trim().toLowerCase())
)

const companyInvalid = computed(() => form.touched && !form.companyName.trim())

const passwordInvalid = computed(() =>
  form.touched &&
  ((props.mode === 'create' && !form.password.trim()) ||
    (form.password.trim().length > 0 && form.password.trim().length < 6))
)

function handleSubmit() {
  form.touched = true

  if (usernameInvalid.value || companyInvalid.value || passwordInvalid.value) {
    return
  }

  emit('submit', {
    username: form.username.trim().toLowerCase(),
    companyName: form.companyName.trim(),
    password: form.password.trim() || null,
  })
}
</script>

<template>
  <div v-if="show" class="overlay" role="dialog" aria-modal="true">
    <div class="modal">
      <header class="modal-header">
        <h2>{{ title }}</h2>
        <button class="btn btn-ghost" type="button" :disabled="submitting" @click="emit('close')">
          {{ t('common.close') }}
        </button>
      </header>

      <form class="form" @submit.prevent="handleSubmit">
        <div>
          <label for="client-username">{{ t('clients.username') }}</label>
          <input
            id="client-username"
            v-model="form.username"
            type="text"
            autocomplete="username"
            :disabled="submitting"
            :class="{ invalid: usernameInvalid }"
            required
          />
          <p v-if="usernameInvalid" class="error">
            {{ t('clients.usernameHelp') }}
          </p>
        </div>

        <div>
          <label for="client-company">{{ t('clients.companyName') }}</label>
          <input
            id="client-company"
            v-model="form.companyName"
            type="text"
            :disabled="submitting"
            :class="{ invalid: companyInvalid }"
            required
          />
          <p v-if="companyInvalid" class="error">
            {{ t('common.required') }}
          </p>
        </div>

        <div>
          <label for="client-password">{{ t('clients.password') }}</label>
          <input
            id="client-password"
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            :disabled="submitting"
            :placeholder="props.mode === 'edit' ? t('clients.passwordOptional') : ''"
            :class="{ invalid: passwordInvalid }"
            :required="props.mode === 'create'"
          />
          <p v-if="passwordInvalid" class="error">
            {{
              props.mode === 'create'
                ? t('clients.passwordRequired')
                : t('clients.passwordMinLength')
            }}
          </p>
          <p v-else-if="props.mode === 'edit'" class="hint">
            {{ t('clients.passwordKeepHint') }}
          </p>
        </div>

        <footer class="modal-footer">
          <button class="btn btn-secondary" type="button" :disabled="submitting" @click="emit('close')">
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

.hint {
  font-size: 12px;
  color: #6b7280;
  margin: 4px 0 0;
}

.invalid {
  border-color: #dc2626;
}
</style>
