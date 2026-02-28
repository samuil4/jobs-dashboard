import { supabase } from './supabase'
import type { JobShareData } from '../types/job'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface VerifyShareResult {
  valid: boolean
  job?: JobShareData
  error?: string
}

export function isValidJobId(jobId: string): boolean {
  return typeof jobId === 'string' && UUID_REGEX.test(jobId.trim())
}

export async function verifyJobSharePassword(
  jobId: string,
  password: string
): Promise<VerifyShareResult> {
  if (!isValidJobId(jobId)) {
    return { valid: false, error: 'Invalid job ID' }
  }

  const { data, error } = await supabase.functions.invoke('verify-job-share-password', {
    body: { job_id: jobId, password },
  })

  if (error) {
    return { valid: false, error: error.message }
  }

  const result = data as { valid: boolean; job?: JobShareData; error?: string } | null
  if (!result || typeof result.valid !== 'boolean') {
    return { valid: false }
  }
  return result
}
