<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import LanguageSwitcher from './components/LanguageSwitcher.vue'
import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

onMounted(async () => {
  if (!authStore.loading) return
  await authStore.init()
})

const showHeader = computed(() => authStore.isAuthenticated && route.name !== 'login')

async function handleLogout() {
  await authStore.signOut()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="app-shell">
    <header v-if="showHeader" class="app-header card">
      <nav class="header-nav">
        <div class="brand">
          <RouterLink :to="{ name: 'dashboard' }" class="brand-link">
            <span class="brand-accent"></span>
            <span class="brand-text">{{ t('auth.title') }}</span>
          </RouterLink>
        </div>
        <div class="actions">
          <LanguageSwitcher />
          <button class="btn btn-secondary" type="button" @click="handleLogout">
            {{ t('auth.logout') }}
          </button>
        </div>
      </nav>
    </header>

    <main class="app-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-header {
  width: 100%;
  max-width: 1200px;
  margin: 24px auto 0;
  padding: 18px 24px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(14px);
  position: sticky;
  top: 0;
  z-index: 20;
}

.header-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 700;
  font-size: 18px;
  color: #1e40af;
}

.brand-link {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: #1f2937;
}

.brand-accent {
  width: 10px;
  height: 32px;
  border-radius: 999px;
  background: linear-gradient(180deg, #2563eb, #1d4ed8);
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.25);
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
