import type { SupabaseClient } from '@supabase/supabase-js'

/** Only refresh-token failures should trigger storage rehydration (not e.g. password grant). */
function isRefreshTokenGrantRequest(url: string, init?: RequestInit): boolean {
  if (!url.includes('/auth/v1/token')) return false
  const body = init?.body
  if (typeof body !== 'string') return false
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    return typeof parsed.refresh_token === 'string' && !('password' in parsed)
  } catch {
    return false
  }
}

function isInvalidRefreshTokenErrorBody(text: string): boolean {
  const t = text.toLowerCase()
  return t.includes('invalid refresh token') || t.includes('invalid refresh_token')
}

export type AuthFatalHandler = (client: SupabaseClient) => Promise<void>

let fatalAuthHandler: AuthFatalHandler | null = null

export function setAuthFatalHandler(handler: AuthFatalHandler | null) {
  fatalAuthHandler = handler
}

async function handleFatalAuthFailure(client: SupabaseClient): Promise<void> {
  if (fatalAuthHandler) {
    await fatalAuthHandler(client)
  } else {
    // Avoid calling into auth-js during a potentially locked/deadlocked refresh flow.
    try {
      const key = (client as unknown as { auth?: { storageKey?: string } })?.auth?.storageKey
      if (typeof localStorage !== 'undefined') {
        if (typeof key === 'string' && key) localStorage.removeItem(key)
      }
    } catch {
      // ignore
    }
    const base = import.meta.env.BASE_URL || '/'
    const loginPath = base.endsWith('/') ? `${base}login` : `${base}/login`
    window.location.href = loginPath
  }
}

export type RecoveryFetchOptions = {
  storageKey: string
  getClient: () => SupabaseClient | null
}

/**
 * Wraps fetch so a failed refresh_token exchange can recover by re-applying the
 * persisted session from localStorage and short-circuiting with a synthetic 200
 * (retrying the same POST would resend the stale refresh body).
 */
export function createInvalidRefreshRecoveryFetch(
  baseFetch: typeof fetch,
  options: RecoveryFetchOptions,
): typeof fetch {
  const { storageKey, getClient } = options
  return async (input, init): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

    const inner = () => baseFetch(input, init)

    if (!isRefreshTokenGrantRequest(url, init ?? undefined)) {
      return inner()
    }

    const response = await inner()
    if (response.ok) return response

    const ct = response.headers.get('content-type') ?? ''
    if (!ct.includes('application/json')) return response

    let bodyText: string
    try {
      bodyText = await response.clone().text()
    } catch {
      return response
    }

    const matchedInvalid = isInvalidRefreshTokenErrorBody(bodyText)
    if (!matchedInvalid) return response

    const client = getClient()
    if (!client) {
      return response
    }

    // IMPORTANT: Do NOT call `client.auth.setSession()` here.
    // This fetch wrapper runs during refresh-token exchange while auth-js holds its internal lock.
    // Calling back into auth-js from here can deadlock the lock queue and freeze the app.
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(storageKey)
      }
    } catch {
      // ignore
    }
    // Fire-and-forget navigation away; don't await to avoid lock-related hangs.
    void handleFatalAuthFailure(client)
    return response
  }
}
