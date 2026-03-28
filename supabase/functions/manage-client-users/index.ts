import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const USERNAME_REGEX = /^[A-Za-z0-9._-]{3,50}$/
const CLIENT_EMAIL_DOMAIN = 'clients.jobs-dashboard.local'

type ClientAction = 'create' | 'update' | 'delete'

type CreatePayload = {
  action: 'create'
  username?: string
  company_name?: string
  password?: string
}

type UpdatePayload = {
  action: 'update'
  client_id?: string
  username?: string
  company_name?: string
  password?: string | null
}

type DeletePayload = {
  action: 'delete'
  client_id?: string
}

type RequestPayload = CreatePayload | UpdatePayload | DeletePayload

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeUsername(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? ''
  if (!USERNAME_REGEX.test(normalized)) {
    throw new Error('Username must be 3-50 characters using letters, numbers, dot, dash, or underscore')
  }
  return normalized
}

function normalizeCompanyName(value: string | undefined): string {
  const normalized = value?.trim() ?? ''
  if (!normalized) {
    throw new Error('Company name is required')
  }
  return normalized
}

function normalizePassword(value: string | undefined | null, required: boolean): string | undefined {
  const normalized = value?.trim() ?? ''
  if (!normalized) {
    if (required) {
      throw new Error('Password is required')
    }
    return undefined
  }
  if (normalized.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }
  return normalized
}

function clientEmail(username: string): string {
  return `${username}@${CLIENT_EMAIL_DOMAIN}`
}

async function requireStaffUser(req: Request, admin: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    throw new Error('Missing authorization token')
  }

  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) {
    throw new Error('Unauthorized')
  }

  const { data: clientRow, error: clientError } = await admin
    .from('clients')
    .select('id')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle()

  if (clientError) {
    console.error('Failed to verify caller role', clientError)
    throw new Error('Could not verify caller role')
  }

  if (clientRow) {
    throw new Error('Clients cannot manage client accounts')
  }

  return authData.user
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const admin = createClient(supabaseUrl, serviceRoleKey)

  try {
    await requireStaffUser(req, admin)

    const payload = (await req.json()) as RequestPayload
    const action = payload?.action as ClientAction | undefined

    if (!action || !['create', 'update', 'delete'].includes(action)) {
      return jsonResponse({ error: 'Invalid action' }, 400)
    }

    if (action === 'create') {
      const username = normalizeUsername(payload.username)
      const companyName = normalizeCompanyName(payload.company_name)
      const password = normalizePassword(payload.password, true)
      const email = clientEmail(username)

      const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username },
      })

      if (createUserError || !createdUser.user) {
        console.error('Failed to create auth user', createUserError)
        return jsonResponse({ error: createUserError?.message ?? 'Could not create client auth user' }, 400)
      }

      const { data: client, error: insertError } = await admin
        .from('clients')
        .insert({
          auth_user_id: createdUser.user.id,
          username,
          company_name: companyName,
          updated_at: new Date().toISOString(),
        })
        .select('id, auth_user_id, username, company_name, created_at, updated_at')
        .single()

      if (insertError || !client) {
        console.error('Failed to insert client row', insertError)
        await admin.auth.admin.deleteUser(createdUser.user.id)
        return jsonResponse({ error: insertError?.message ?? 'Could not create client record' }, 400)
      }

      return jsonResponse({ client })
    }

    if (action === 'update') {
      const clientId = payload.client_id?.trim()
      if (!clientId) {
        return jsonResponse({ error: 'Client ID is required' }, 400)
      }

      const { data: existingClient, error: fetchError } = await admin
        .from('clients')
        .select('id, auth_user_id, username')
        .eq('id', clientId)
        .single()

      if (fetchError || !existingClient) {
        return jsonResponse({ error: 'Client not found' }, 404)
      }

      const username = normalizeUsername(payload.username)
      const companyName = normalizeCompanyName(payload.company_name)
      const password = normalizePassword(payload.password, false)
      const email = clientEmail(username)

      const updateUserPayload: { email: string; password?: string; user_metadata: { username: string } } = {
        email,
        user_metadata: { username },
      }

      if (password) {
        updateUserPayload.password = password
      }

      const { error: updateUserError } = await admin.auth.admin.updateUserById(
        existingClient.auth_user_id,
        updateUserPayload
      )

      if (updateUserError) {
        console.error('Failed to update auth user', updateUserError)
        return jsonResponse({ error: updateUserError.message }, 400)
      }

      const { data: client, error: updateError } = await admin
        .from('clients')
        .update({
          username,
          company_name: companyName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId)
        .select('id, auth_user_id, username, company_name, created_at, updated_at')
        .single()

      if (updateError || !client) {
        console.error('Failed to update client row', updateError)
        return jsonResponse({ error: updateError?.message ?? 'Could not update client record' }, 400)
      }

      return jsonResponse({ client })
    }

    const clientId = payload.client_id?.trim()
    if (!clientId) {
      return jsonResponse({ error: 'Client ID is required' }, 400)
    }

    const { data: existingClient, error: fetchError } = await admin
      .from('clients')
      .select('id, auth_user_id')
      .eq('id', clientId)
      .single()

    if (fetchError || !existingClient) {
      return jsonResponse({ error: 'Client not found' }, 404)
    }

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(existingClient.auth_user_id)
    if (deleteUserError) {
      console.error('Failed to delete auth user', deleteUserError)
      return jsonResponse({ error: deleteUserError.message }, 400)
    }

    const { error: deleteClientError } = await admin.from('clients').delete().eq('id', clientId)
    if (deleteClientError) {
      console.error('Failed to delete client row', deleteClientError)
      return jsonResponse({ error: deleteClientError.message }, 400)
    }

    return jsonResponse({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    const status = message === 'Unauthorized' || message === 'Missing authorization token' ? 401 : 403
    console.error('manage-client-users error:', err)
    return jsonResponse({ error: message }, status)
  }
})
