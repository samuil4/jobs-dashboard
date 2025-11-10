<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const submitting = ref(false)
const localError = ref<string | null>(null)

async function handleSubmit() {
  if (!username.value || !password.value) {
    localError.value = t('common.required')
    return
  }

  submitting.value = true
  localError.value = null

  try {
    await authStore.signIn(username.value, password.value)
    const redirect = (route.query.redirect as string) ?? '/'
    router.replace(redirect)
  } catch (err) {
    console.error(err)
    localError.value = t('auth.error')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card card">
      <div class="login-header">
        <div class="badge badge-warning">Manufacturing</div>
        <h1>{{ t('auth.title') }}</h1>
        <p>{{ t('auth.subtitle') }}</p>
      </div>

      <form class="login-form" @submit.prevent="handleSubmit">
        <label for="username">{{ t('auth.username') }}</label>
        <input
          id="username"
          v-model="username"
          type="text"
          autocomplete="username"
          required
        />

        <label for="password">{{ t('auth.password') }}</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        />

        <p v-if="localError" class="error">{{ localError }}</p>

        <button class="btn btn-primary" type="submit" :disabled="submitting">
          <span v-if="submitting">{{ t('auth.signingIn') }}</span>
          <span v-else>{{ t('auth.signIn') }}</span>
        </button>
      </form>

      <div class="login-footer">
        <LanguageSwitcher />
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: calc(100vh - 48px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.login-card {
  max-width: 420px;
  width: 100%;
  text-align: left;
}

.login-header {
  margin-bottom: 24px;
}

.login-header h1 {
  margin: 12px 0 8px;
  font-size: 28px;
  font-weight: 700;
}

.login-header p {
  margin: 0;
  color: #4b5563;
  font-size: 15px;
}

.login-form {
  display: flex;
  flex-direction: column;
}

.error {
  color: #dc2626;
  font-size: 13px;
  margin: -4px 0 12px;
}

.login-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}
</style>

