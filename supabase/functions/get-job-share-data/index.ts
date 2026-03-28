import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { job_id, share_token } = (await req.json()) as {
      job_id?: string
      share_token?: string
    }
    if (typeof job_id !== 'string' || !UUID_REGEX.test(job_id.trim())) {
      return new Response(
        JSON.stringify({ error: 'Invalid job ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (typeof share_token !== 'string' || !UUID_REGEX.test(share_token.trim())) {
      return new Response(
        JSON.stringify({ error: 'Invalid share token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const jobId = job_id.trim()
    const token = share_token.trim()

    const { data: tokenRow, error: tokenError } = await supabase
      .from('share_tokens')
      .select('id')
      .eq('job_id', jobId)
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (tokenError || !tokenRow) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('id, name, parts_needed, parts_produced, parts_overproduced, delivered')
      .eq('id', jobId)
      .single()

    if (fetchError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload = {
      job: {
        id: job.id,
        name: job.name,
        parts_needed: job.parts_needed,
        parts_produced: job.parts_produced,
        parts_overproduced: job.parts_overproduced ?? 0,
        delivered: job.delivered ?? 0,
      },
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('get-job-share-data error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
