import { supabase } from './supabase'
import type { ClientRecord, ClientFormPayload } from '../types/client'

interface ClientResponse {
  client?: ClientRecord
  success?: boolean
  error?: string
}

function normalizePayload(payload: ClientFormPayload) {
  return {
    username: payload.username.trim().toLowerCase(),
    company_name: payload.companyName.trim(),
    password: payload.password?.trim() ? payload.password.trim() : undefined,
  }
}

async function invokeClientAdmin(body: Record<string, unknown>): Promise<ClientResponse> {
  const { data, error } = await supabase.functions.invoke('manage-client-users', { body })

  if (error) {
    return { error: error.message }
  }

  return (data as ClientResponse | null) ?? {}
}

export async function createClientAccount(payload: ClientFormPayload): Promise<ClientResponse> {
  return invokeClientAdmin({
    action: 'create',
    ...normalizePayload(payload),
  })
}

export async function updateClientAccount(
  clientId: string,
  payload: ClientFormPayload
): Promise<ClientResponse> {
  return invokeClientAdmin({
    action: 'update',
    client_id: clientId,
    ...normalizePayload(payload),
  })
}

export async function deleteClientAccount(clientId: string): Promise<ClientResponse> {
  return invokeClientAdmin({
    action: 'delete',
    client_id: clientId,
  })
}
