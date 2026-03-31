<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import AppFooterBar from './components/AppFooterBar.vue'
import Toast from './components/Toast.vue'
import { Toaster } from 'vue-sonner'
import { useManufacturingNotifications } from './composables/useManufacturingNotifications'
import { useAuthStore } from './stores/auth'
import { useJobsStore } from './stores/jobs'

const authStore = useAuthStore()

useManufacturingNotifications()
const jobsStore = useJobsStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const { searchTerm, statusFilter } = storeToRefs(jobsStore)

const menuOpen = ref(false)
const menuAnchorRef = ref<HTMLElement | null>(null)
const isStaffRoute = computed(() => route.meta.audience === 'staff')
const isClientRoute = computed(() => route.meta.audience === 'client')
const showHeader = computed(() => authStore.isAuthenticated && authStore.isStaff && isStaffRoute.value)
const showFooter = computed(
  () =>
    authStore.isAuthenticated &&
    route.name !== 'login' &&
    route.name !== 'clientLogin' &&
    route.name !== 'jobShare',
)
const isDashboard = computed(() => route.name === 'dashboard')
const isClientsPage = computed(() => route.name === 'clients')
const pageTitle = computed(() => {
  if (isClientsPage.value) return t('clients.heading')
  return t('navigation.dashboard')
})
const footerPushMode = computed(() => (isClientRoute.value ? 'client' : 'auth'))


// Provide ref for openCreateModal function (to be set by DashboardView)
const openCreateModalRef = ref<(() => void) | null>(null)
provide('openCreateModal', openCreateModalRef)
const openCreateClientModalRef = ref<(() => void) | null>(null)
provide('openCreateClientModal', openCreateClientModalRef)

// Function to call from header button
function handleAddJob() {
  if (openCreateModalRef.value) {
    openCreateModalRef.value()
  }
  menuOpen.value = false
}

function handleAddClient() {
  if (openCreateClientModalRef.value) {
    openCreateClientModalRef.value()
  }
  menuOpen.value = false
}

function navigateTo(name: 'dashboard' | 'clients') {
  menuOpen.value = false
  router.push({ name })
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}


function onClickOutsideMenu(event: MouseEvent) {
  const target = event.target as Node
  if (menuOpen.value && menuAnchorRef.value && !menuAnchorRef.value.contains(target)) {
    menuOpen.value = false
  }
}

onMounted(async () => {
  document.addEventListener('click', onClickOutsideMenu as EventListener)
  if (!authStore.loading) return
  await authStore.init()
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutsideMenu as EventListener)
})

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)
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
        </template>
        <h1 v-else class="header-title">{{ pageTitle }}</h1>

        <div ref="menuAnchorRef" class="header-menu">
          <button
            class="btn btn-compact btn-secondary"
            type="button"
            :aria-expanded="menuOpen"
            @click.stop="toggleMenu"
          >
            {{ t('navigation.menu') }}
          </button>

          <div v-if="menuOpen" class="menu-dropdown" role="menu" @click.stop>
            <button
              v-if="!isDashboard"
              class="menu-item"
              type="button"
              role="menuitem"
              @click="navigateTo('dashboard')"
            >
              {{ t('navigation.dashboard') }}
            </button>
            <button
              v-if="!isClientsPage"
              class="menu-item"
              type="button"
              role="menuitem"
              @click="navigateTo('clients')"
            >
              {{ t('navigation.clients') }}
            </button>
            <button
              v-if="isDashboard"
              class="menu-item"
              type="button"
              role="menuitem"
              @click="handleAddJob"
            >
              {{ t('jobs.addJob') }}
            </button>
            <button
              v-if="isClientsPage"
              class="menu-item"
              type="button"
              role="menuitem"
              @click="handleAddClient"
            >
              {{ t('clients.addClient') }}
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="app-content" :class="{ 'app-content-no-header': !showHeader }">
      <RouterView />
    </main>

    <Toast />
    <Toaster richColors position="top-center" />
    <AppFooterBar v-if="showFooter" :push-mode="footerPushMode" />
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

.header-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
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

.header-menu {
  position: relative;
  margin-left: auto;
}

.menu-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 220px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.16);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 120;
}

.menu-item {
  border: none;
  background: transparent;
  text-align: left;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

.menu-item:hover {
  background: #f3f4f6;
}

.app-content-no-header {
  padding-top: 24px;
  min-height: calc(100vh - 48px);
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

  .header-menu {
    width: 100%;
    margin-left: 0;
  }

  .header-menu .btn {
    width: 100%;
    justify-content: center;
  }

  .btn-compact {
    font-size: 12px;
    padding: 6px 10px;
    white-space: nowrap;
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
