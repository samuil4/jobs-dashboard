import type { Session, SupabaseClient } from '@supabase/supabase-js'

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

function readPersistedSessionJson(
  storageKey: string,
): { access_token: string; refresh_token: string } | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(storageKey)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('access_token' in parsed) ||
      !('refresh_token' in parsed)
    ) {
      return null
    }
    const access_token = (parsed as { access_token: unknown }).access_token
    const refresh_token = (parsed as { refresh_token: unknown }).refresh_token
    if (typeof access_token !== 'string' || typeof refresh_token !== 'string') return null
    return { access_token, refresh_token }
  } catch {
    return null
  }
}

async function rehydrateSessionFromStorage(
  client: SupabaseClient,
  storageKey: string,
): Promise<Session | null> {
  const tokens = readPersistedSessionJson(storageKey)
  if (!tokens) return null
  const { data, error } = await client.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  })
  if (error || !data.session) return null
  return data.session
}

function tokenRefreshSuccessResponse(session: Session): Response {
  const expiresAt = session.expires_at ?? 0
  const expiresIn =
    session.expires_in ?? Math.max(60, expiresAt - Math.floor(Date.now() / 1000))
  const body = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: expiresIn,
    expires_at: expiresAt,
    token_type: session.token_type ?? 'bearer',
    user: session.user,
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  })
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
    await client.auth.signOut({ scope: 'local' })
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

    if (!isInvalidRefreshTokenErrorBody(bodyText)) return response

    const client = getClient()
    if (!client) return response

    const session = await rehydrateSessionFromStorage(client, storageKey)
    if (!session) {
      await handleFatalAuthFailure(client)
      return response
    }

    return tokenRefreshSuccessResponse(session)
  }
}
