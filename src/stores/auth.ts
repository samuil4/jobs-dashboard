import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Session, User } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'

const AUTH_EMAIL_DOMAIN = import.meta.env.VITE_SUPABASE_AUTH_EMAIL_DOMAIN ?? 'example.com'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function init() {
    const {
      data: { session: initialSession },
    } = await supabase.auth.getSession()
    session.value = initialSession ?? null
    user.value = initialSession?.user ?? null
    loading.value = false

    supabase.auth.onAuthStateChange((_event, newSession) => {
      session.value = newSession ?? null
      user.value = newSession?.user ?? null
    })
  }

  function resolveEmail(username: string) {
    if (username.includes('@')) {
      return username
    }
    return `${username}@${AUTH_EMAIL_DOMAIN}`
  }

  async function signIn(username: string, password: string) {
    error.value = null
    const email = resolveEmail(username.trim())

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
  }

  async function signOut() {
    await supabase.auth.signOut()
    session.value = null
    user.value = null
  }

  const isAuthenticated = computed(() => Boolean(session.value))
  const userEmail = computed(() => user.value?.email ?? null)
  const userId = computed(() => user.value?.id ?? null)

  return {
    session,
    user,
    loading,
    error,
    isAuthenticated,
    userEmail,
    userId,
    init,
    signIn,
    signOut,
  }
})

