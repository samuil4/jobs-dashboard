import { createRouter, createWebHistory } from 'vue-router'

import { pinia } from '../stores'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresAuth: false, audience: 'staff' },
    },
    {
      path: '/client/login',
      name: 'clientLogin',
      component: () => import('../views/ClientLoginView.vue'),
      meta: { requiresAuth: false, audience: 'client' },
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true, audience: 'staff' },
    },
    {
      path: '/clients',
      name: 'clients',
      component: () => import('../views/ClientsView.vue'),
      meta: { requiresAuth: true, audience: 'staff' },
    },
    {
      path: '/statistics',
      name: 'statistics',
      component: () => import('../views/StatisticsView.vue'),
      meta: { requiresAuth: true, audience: 'staff' },
    },
    {
      path: '/client/jobs',
      name: 'clientJobs',
      component: () => import('../views/ClientPortalView.vue'),
      meta: { requiresAuth: true, audience: 'client' },
    },
    {
      path: '/share/:jobId',
      name: 'jobShare',
      component: () => import('../views/JobShareView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/:catchAll(.*)',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore(pinia)
  if (authStore.loading) {
    await authStore.init()
  }

  const requiresAuth = to.meta.requiresAuth !== false
  const audience = to.meta.audience as 'staff' | 'client' | undefined

  if (requiresAuth && !authStore.isAuthenticated) {
    return next({
      name: audience === 'client' ? 'clientLogin' : 'login',
      query: { redirect: to.fullPath },
    })
  }

  // Only redirect signed-in users away from the login screens once their role is known,
  // so an unresolved role never bounces between /login and a staff-only route.
  if (to.name === 'login' && authStore.isAuthenticated) {
    if (authStore.isClient) return next({ name: 'clientJobs' })
    if (authStore.isStaff) return next({ name: 'dashboard' })
    return next()
  }

  if (to.name === 'clientLogin' && authStore.isAuthenticated) {
    if (authStore.isClient) return next({ name: 'clientJobs' })
    if (authStore.isStaff) return next({ name: 'dashboard' })
    return next()
  }

  // Staff areas are staff-only: clients go to their portal, unresolved roles are denied.
  if (audience === 'staff' && authStore.isAuthenticated && !authStore.isStaff) {
    if (authStore.isClient) return next({ name: 'clientJobs' })
    return next({ name: 'login', query: { redirect: to.fullPath } })
  }

  if (authStore.isAuthenticated && authStore.isStaff && audience === 'client') {
    return next({ name: 'dashboard' })
  }

  return next()
})

export default router
