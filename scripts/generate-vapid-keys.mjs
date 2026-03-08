#!/usr/bin/env node
/**
 * Generates VAPID keys for Web Push (Node.js - no Deno required).
 * Uses npx deno to run the negrel webpush script, which outputs the correct
 * format for the Edge Function (JWK) and the client (base64url public key).
 *
 * Run: node scripts/generate-vapid-keys.mjs
 * Or: npm run vapid-keys
 */
import { spawnSync } from 'node:child_process'

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(
  cmd,
  ['--yes', 'deno', 'run', 'https://raw.githubusercontent.com/negrel/webpush/master/cmd/generate-vapid-keys.ts'],
  { encoding: 'utf8', stdio: 'pipe', shell: true }
)

if (result.status !== 0) {
  console.error(result.stderr || result.error)
  process.exit(1)
}

// stdout = JSON (VAPID_KEYS_JSON), stderr = "your application server key is: BASE64URL"
const vapidKeysJson = result.stdout.trim()
const stderr = result.stderr || ''
const match = stderr.match(/your application server key is: (\S+)/)
const applicationServerKey = match ? match[1].trim() : ''

console.log('1. VAPID_KEYS_JSON (for Edge Function secret - supabase secrets set):')
console.log(vapidKeysJson)
console.log('')
console.log('2. VITE_VAPID_PUBLIC_KEY (add to .env.local):')
console.log(applicationServerKey)
