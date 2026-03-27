import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface PushSubscriptionJson {
  endpoint: string
  keys?: {
    p256dh: string
    auth: string
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as {
      job_id?: string
      password?: string
      share_token?: string
      subscription?: PushSubscriptionJson
    }
    const { job_id, password, share_token, subscription } = body

    if (typeof job_id !== 'string' || !UUID_REGEX.test(job_id.trim())) {
      return new Response(
        JSON.stringify({ error: 'Invalid job ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const hasPassword = typeof password === 'string'
    const hasShareToken =
      typeof share_token === 'string' && UUID_REGEX.test(share_token.trim())
    if (!hasPassword && !hasShareToken) {
      return new Response(
        JSON.stringify({ error: 'Password or share token required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!subscription || typeof subscription !== 'object' || !subscription.endpoint) {
      return new Response(
        JSON.stringify({ error: 'Invalid subscription' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const jobId = job_id.trim()

    if (hasShareToken) {
      const { data: tokenRow, error: tokenError } = await supabase
        .from('share_tokens')
        .select('id')
        .eq('job_id', jobId)
        .eq('token', share_token!.trim())
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (tokenError || !tokenRow) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      const { data: job, error: fetchError } = await supabase
        .from('jobs')
        .select('id, share_password_hash')
        .eq('id', jobId)
        .single()

      if (fetchError || !job) {
        return new Response(
          JSON.stringify({ error: 'Job not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const hash = job.share_password_hash
      if (!hash) {
        return new Response(
          JSON.stringify({ error: 'No share password' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const matches = bcrypt.compareSync(password!, hash)
      if (!matches) {
        return new Response(
          JSON.stringify({ error: 'Invalid password' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const { error: insertError } = await supabase.from('share_push_subscriptions').insert({
      job_id: jobId,
      subscription: subscription as Record<string, unknown>,
    })

    if (insertError) {
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ ok: true, message: 'Already subscribed' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      throw insertError
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('register-share-push error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
