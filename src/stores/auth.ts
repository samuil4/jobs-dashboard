import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Session, User } from '@supabase/supabase-js'

import { supabase, SUPABASE_AUTH_STORAGE_KEY } from '../lib/supabase'
import type { ClientRecord } from '../types/client'

const AUTH_EMAIL_DOMAIN = import.meta.env.VITE_SUPABASE_AUTH_EMAIL_DOMAIN ?? 'example.com'
const CLIENT_EMAIL_DOMAIN = 'clients.jobs-dashboard.local'
type UserRole = 'staff' | 'client' | null
type ClientProfile = Pick<ClientRecord, 'id' | 'username' | 'company_name'>

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const userRole = ref<UserRole>(null)
  const clientProfile = ref<ClientProfile | null>(null)

  async function resolveAccessProfile(userId: string | null) {
    if (!userId) {
      userRole.value = null
      clientProfile.value = null
      return
    }

    const { data, error: profileError } = await supabase
      .from('clients')
      .select('id, username, company_name')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (profileError) {
      error.value = profileError.message
      throw profileError
    }

    if (data) {
      userRole.value = 'client'
      clientProfile.value = data as ClientProfile
      return
    }

    userRole.value = 'staff'
    clientProfile.value = null
  }

  async function init() {
    const {
      data: { session: initialSession },
    } = await supabase.auth.getSession()
    session.value = initialSession ?? null
    user.value = initialSession?.user ?? null
    try {
      await resolveAccessProfile(initialSession?.user?.id ?? null)
    } finally {
      loading.value = false
    }

    supabase.auth.onAuthStateChange(async (_event, newSession) => {
      try {
        session.value = newSession ?? null
        user.value = newSession?.user ?? null
        await resolveAccessProfile(newSession?.user?.id ?? null)
      } catch (err) {
        console.error('Failed to resolve access profile after auth state change', err)
      }
    })
  }

  function resolveEmail(username: string, mode: 'staff' | 'client' = 'staff') {
    if (username.includes('@')) {
      return username
    }
    const domain = mode === 'client' ? CLIENT_EMAIL_DOMAIN : AUTH_EMAIL_DOMAIN
    return `${username}@${domain}`
  }

  async function signIn(username: string, password: string, mode: 'staff' | 'client' = 'staff') {
    error.value = null
    const email = resolveEmail(username.trim(), mode)

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      error.value = authError.message
      throw authError
    }

    session.value = data.session
    user.value = data.user
    await resolveAccessProfile(data.user?.id ?? null)
  }

  async function signOut() {
    await supabase.auth.signOut()
    session.value = null
    user.value = null
    userRole.value = null
    clientProfile.value = null
  }

  async function rehydrateFromStorage(): Promise<boolean> {
    try {
      const raw = localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY)
      if (!raw) return false

      const stored: { access_token?: string; refresh_token?: string } = JSON.parse(raw)
      if (!stored.access_token || !stored.refresh_token) return false

      const { data, error: setError } = await supabase.auth.setSession({
        access_token: stored.access_token,
        refresh_token: stored.refresh_token,
      })

      if (setError || !data.session) return false

      session.value = data.session
      user.value = data.session.user
      await resolveAccessProfile(data.session.user?.id ?? null)
      return true
    } catch {
      return false
    }
  }

  async function withTokenRecovery<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      const isInvalidRefreshToken =
        msg.includes('invalid refresh token') ||
        msg.includes('refresh_token_not_found') ||
        (err as { code?: string })?.code === 'invalid_grant'

      if (isInvalidRefreshToken) {
        const recovered = await rehydrateFromStorage()
        if (recovered) {
          return await fn()
        }
        await signOut()
      }

      throw err
    }
  }

  const isAuthenticated = computed(() => Boolean(session.value))
  const userEmail = computed(() => user.value?.email ?? null)
  const userId = computed(() => user.value?.id ?? null)
  const isClient = computed(() => userRole.value === 'client')
  const isStaff = computed(() => userRole.value === 'staff')
  const clientId = computed(() => clientProfile.value?.id ?? null)
  const clientUsername = computed(() => clientProfile.value?.username ?? null)
  const clientCompanyName = computed(() => clientProfile.value?.company_name ?? null)

  return {
    session,
    user,
    loading,
    error,
    userRole,
    clientProfile,
    isAuthenticated,
    userEmail,
    userId,
    isClient,
    isStaff,
    clientId,
    clientUsername,
    clientCompanyName,
    init,
    signIn,
    signOut,
    resolveAccessProfile,
    rehydrateFromStorage,
    withTokenRecovery,
  }
})

