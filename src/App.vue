<script setup lang="ts">
import { computed, onMounted, provide, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import LanguageSwitcher from './components/LanguageSwitcher.vue'
import { useAuthStore } from './stores/auth'
import { useJobsStore } from './stores/jobs'

const authStore = useAuthStore()
const jobsStore = useJobsStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const { searchTerm, statusFilter, showArchived } = storeToRefs(jobsStore)

const showHeader = computed(
  () =>
    authStore.isAuthenticated &&
    route.name !== 'login' &&
    route.name !== 'jobShare'
)
const showFooter = computed(
  () =>
    authStore.isAuthenticated &&
    route.name !== 'login' &&
    route.name !== 'jobShare'
)
const isDashboard = computed(() => route.name === 'dashboard')

const archivedToggleLabel = computed(() =>
  showArchived.value ? t('jobs.filter.hideArchived') : t('jobs.filter.showArchived')
)

// Provide ref for openCreateModal function (to be set by DashboardView)
const openCreateModalRef = ref<(() => void) | null>(null)
provide('openCreateModal', openCreateModalRef)

// Function to call from header button
function handleAddJob() {
  if (openCreateModalRef.value) {
    openCreateModalRef.value()
  }
}

onMounted(async () => {
  if (!authStore.loading) return
  await authStore.init()
})

async function handleLogout() {
  await authStore.signOut()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="app-shell">
    <header v-if="showHeader" class="app-header">
      <div class="header-content">
        <template v-if="isDashboard">
          <input
            id="search"
            v-model="searchTerm"
            type="search"
            class="header-input"
            :placeholder="t('jobs.filter.search')"
          />
          <select id="status-filter" v-model="statusFilter" class="header-select">
            <option value="all">{{ t('jobs.filter.all') }}</option>
            <option value="active">{{ t('jobs.filter.active') }}</option>
            <option value="completed">{{ t('jobs.filter.completed') }}</option>
            <option value="archived">{{ t('jobs.filter.archived') }}</option>
          </select>
          <button class="btn btn-compact btn-secondary" type="button" @click="jobsStore.toggleArchivedVisibility">
            {{ archivedToggleLabel }}
          </button>
          <button class="btn btn-compact btn-primary" type="button" @click="handleAddJob">
            {{ t('jobs.addJob') }}
          </button>
        </template>
      </div>
    </header>

    <main class="app-content">
      <RouterView />
    </main>

    <footer v-if="showFooter" class="app-footer">
      <div class="footer-content">
        <LanguageSwitcher />
        <button class="btn btn-compact btn-secondary" type="button" @click="handleLogout">
          {{ t('auth.logout') }}
        </button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  z-index: 100;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 100%;
}

.header-input {
  flex: 1;
  min-width: 200px;
  height: 32px;
  padding: 6px 12px;
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  margin: 0;
  width: auto;
}

.header-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.header-select {
  min-width: 120px;
  height: 32px;
  padding: 6px 12px;
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  margin: 0;
  width: auto;
}

.header-select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.app-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 48px;
  padding: 8px 16px;
  background: #fff;
  border-top: 1px solid #e5e7eb;
  z-index: 100;
  box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.1);
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  height: 100%;
}

@media (max-width: 768px) {
  .header-content {
    gap: 8px;
    flex-wrap: wrap;
  }

  .header-input {
    min-width: 150px;
    flex: 1 1 150px;
  }

  .header-select {
    min-width: 100px;
    flex: 0 0 auto;
  }

  .btn-compact {
    font-size: 12px;
    padding: 6px 10px;
    white-space: nowrap;
  }

  .footer-content {
    gap: 8px;
  }

  .language-switcher {
    min-width: 100px;
  }
}

@media (max-width: 640px) {
  .app-header {
    height: auto;
    min-height: 56px;
    padding: 8px 12px;
  }

  .header-content {
    gap: 6px;
  }

  .header-input {
    min-width: 120px;
    font-size: 13px;
  }

  .header-select {
    min-width: 90px;
    font-size: 13px;
  }

  .btn-compact {
    font-size: 11px;
    padding: 5px 8px;
  }
}
</style>
