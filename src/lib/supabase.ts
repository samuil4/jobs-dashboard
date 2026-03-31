import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { createInvalidRefreshRecoveryFetch } from './authRecoveryFetch'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing configuration. Check your environment variables.')
}

/** Must stay in sync with `auth.storageKey` below (persisted session in localStorage). */
export const SUPABASE_AUTH_STORAGE_KEY = 'jobs-dashboard-auth'

const clientRef: { current: SupabaseClient | null } = { current: null }

const recoveryFetch = createInvalidRefreshRecoveryFetch(
  (...args: Parameters<typeof fetch>) => fetch(...args),
  {
    storageKey: SUPABASE_AUTH_STORAGE_KEY,
    getClient: () => clientRef.current,
  },
)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: SUPABASE_AUTH_STORAGE_KEY,
  },
  global: {
    fetch: recoveryFetch,
  },
})

clientRef.current = supabase

