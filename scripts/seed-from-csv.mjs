import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'
import { parse } from 'date-fns'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']

function ensureEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

function parseHistory(historyRaw) {
  if (!historyRaw) return []
  return historyRaw
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [datePart, rest] = entry.split('→').map((part) => part.trim())
      const deltaMatch = rest?.match(/(\d+)/)
      const delta = deltaMatch ? Number.parseInt(deltaMatch[1], 10) : 0
      const parsedDate = parse(datePart, 'dd/MM/yyyy, HH:mm:ss', new Date())
      return {
        delta,
        created_at: Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString(),
      }
    })
}

async function seed() {
  ensureEnv()

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const csvPath = path.resolve(__dirname, '../reference/uchet_izdeliy.csv')
  const content = await readFile(csvPath, 'utf-8')

  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
  lines.shift()

  const assignees = ['Samuil', 'Oleksii', 'Veselin']
  let assigneeIndex = 0

  for (const line of lines) {
    const [name, plan, produced, , historyRaw] = line.split(';').map((value) => value.trim())
    const partsNeeded = Number.parseInt(plan, 10)
    const partsProduced = Number.parseInt(produced, 10)
    const status = partsProduced >= partsNeeded ? 'completed' : 'active'
    const createdAt = new Date().toISOString()

    const assignee = assignees[assigneeIndex % assignees.length]
    assigneeIndex += 1

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .insert({
        name,
        parts_needed: partsNeeded,
        parts_produced: partsProduced,
        notes: null,
        delivered: 0,
        archived: false,
        status,
        assignee,
        created_at: createdAt,
        updated_at: createdAt,
      })
      .select('id')
      .single()

    if (jobError) {
      console.error(`Failed to insert job "${name}":`, jobError.message)
      continue
    }

    const historyItems = parseHistory(historyRaw)
    if (historyItems.length === 0) continue

    const historyPayload = historyItems.map((item) => ({
      job_id: jobData.id,
      delta: item.delta,
      update_type: 'production',
      created_at: item.created_at,
    }))

    const { error: historyError } = await supabase.from('job_updates').insert(historyPayload)
    if (historyError) {
      console.error(`Failed to insert history for job "${name}":`, historyError.message)
    }
  }

  console.log('Seeding completed.')
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})

