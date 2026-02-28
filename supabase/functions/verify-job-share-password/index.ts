import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

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
    const { job_id, password } = (await req.json()) as { job_id?: string; password?: string }
    if (typeof job_id !== 'string' || !UUID_REGEX.test(job_id.trim())) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid job ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (typeof password !== 'string') {
      return new Response(
        JSON.stringify({ valid: false, error: 'Password required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('id, name, parts_needed, parts_produced, parts_overproduced, delivered, share_password_hash')
      .eq('id', job_id.trim())
      .single()

    if (fetchError || !job) {
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const hash = job.share_password_hash
    if (!hash) {
      return new Response(
        JSON.stringify({ valid: false, error: 'no_share_password' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use compareSync: Edge runtime lacks Worker, so async bcrypt.compare throws
    const matches = bcrypt.compareSync(password, hash)
    if (!matches) {
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload = {
      valid: true,
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
    console.error('verify-job-share-password error:', err)
    return new Response(
      JSON.stringify({ valid: false, error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
