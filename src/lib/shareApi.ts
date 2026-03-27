import { supabase } from './supabase'
import type { JobShareData } from '../types/job'
import { isValidJobId } from './share'

export interface GetJobShareDataResult {
  job?: JobShareData
  error?: string
}

export async function getJobShareData(
  jobId: string,
  shareToken: string
): Promise<GetJobShareDataResult> {
  if (!isValidJobId(jobId)) {
    return { error: 'Invalid job ID' }
  }
  if (!shareToken || typeof shareToken !== 'string') {
    return { error: 'Invalid share token' }
  }

  const { data, error } = await supabase.functions.invoke('get-job-share-data', {
    body: { job_id: jobId, share_token: shareToken },
  })

  if (error) {
    return { error: error.message }
  }

  const result = data as { job?: JobShareData; error?: string } | null
  if (!result || result.error) {
    return { error: result?.error ?? 'Unknown error' }
  }
  if (!result.job) {
    return { error: 'Job not found' }
  }

  return { job: result.job }
}
