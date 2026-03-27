import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  ApplicationServer,
  importVapidKeys,
  type ExportedVapidKeys,
  type PushSubscription as WebPushSubscription,
} from 'jsr:@negrel/webpush@0.5.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface JobUpdateRecord {
  id: string
  job_id: string
  delta: number
  update_type?: 'production' | 'delivery' | 'failed_production'
  created_at: string
  updated_by?: string | null
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: JobUpdateRecord
  old_record: JobUpdateRecord | null
}

interface PushSubscriptionRow {
  id: string
  user_id: string
  subscription: WebPushSubscription
}

interface SharePushSubscriptionRow {
  id: string
  job_id: string
  subscription: WebPushSubscription
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = (await req.json()) as WebhookPayload
    if (payload.type !== 'INSERT' || payload.table !== 'job_updates') {
      return new Response(JSON.stringify({ ok: true, skipped: 'not job_updates INSERT' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const record = payload.record
    if (!record?.job_id) {
      return new Response(JSON.stringify({ ok: false, error: 'missing job_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const vapidKeysJson = Deno.env.get('VAPID_KEYS_JSON')
    if (!vapidKeysJson) {
      console.error('VAPID_KEYS_JSON secret not set')
      return new Response(JSON.stringify({ ok: false, error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('name')
      .eq('id', record.job_id)
      .single()

    const jobName = job?.name ?? record.job_id
    if (jobError) {
      console.warn('Failed to fetch job name:', jobError)
    }

    const updateType = record.update_type ?? 'production'
    const delta = record.delta ?? 0

    let title: string
    let body: string
    switch (updateType) {
      case 'production':
        title = 'Jobs Dashboard'
        body = `Job ${jobName}: +${delta} parts produced`
        break
      case 'delivery':
        title = 'Jobs Dashboard'
        body = `Job ${jobName}: +${delta} parts delivered`
        break
      case 'failed_production':
        title = 'Jobs Dashboard'
        body = `Job ${jobName}: +${delta} parts failed`
        break
      default:
        title = 'Jobs Dashboard'
        body = `Job ${jobName}: +${delta} parts`
    }

    const [dashboardResult, shareResult] = await Promise.all([
      supabase.from('push_subscriptions').select('id, user_id, subscription'),
      supabase
        .from('share_push_subscriptions')
        .select('id, job_id, subscription')
        .eq('job_id', record.job_id),
    ])

    const dashboardSubs = (dashboardResult.error ? [] : dashboardResult.data ?? []) as PushSubscriptionRow[]
    const shareSubs = (shareResult.error ? [] : shareResult.data ?? []) as SharePushSubscriptionRow[]

    if (!dashboardSubs.length && !shareSubs.length) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, message: 'No push subscriptions' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const exportedKeys = JSON.parse(vapidKeysJson) as ExportedVapidKeys
    const vapidKeys = await importVapidKeys(exportedKeys)
    const appServer = await ApplicationServer.new({
      vapidKeys,
      contactInformation: 'mailto:support@example.com',
    })

    const messagePayload = JSON.stringify({ title, body })
    let sent = 0
    const dashboardGone: string[] = []
    const shareGone: string[] = []

    async function sendToSub(
      row: { id: string; subscription: WebPushSubscription },
      gone: string[]
    ) {
      const sub = row.subscription
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return
      try {
        const subscriber = appServer.subscribe(sub as unknown as globalThis.PushSubscription)
        await subscriber.pushTextMessage(messagePayload, { urgency: 'high' })
        sent++
      } catch (err: unknown) {
        const status = err && typeof err === 'object' && 'response' in err
          ? (err as { response?: Response }).response?.status
          : undefined
        if (status === 404 || status === 410) {
          gone.push(row.id)
        } else {
          console.warn('Push failed for subscription', row.id, err)
        }
      }
    }

    for (const row of dashboardSubs) {
      await sendToSub(row, dashboardGone)
    }
    for (const row of shareSubs) {
      await sendToSub(row, shareGone)
    }

    if (dashboardGone.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', dashboardGone)
    }
    if (shareGone.length > 0) {
      await supabase.from('share_push_subscriptions').delete().in('id', shareGone)
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent,
        gone: dashboardGone.length + shareGone.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('send-manufacturing-push error:', err)
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
