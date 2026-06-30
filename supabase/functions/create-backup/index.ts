import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!
const R2_ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID')!
const R2_SECRET_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!
const R2_BUCKET = Deno.env.get('R2_BUCKET_NAME')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

async function hmac(key: ArrayBuffer | Uint8Array, data: string) {
  const k = await crypto.subtle.importKey('raw', key instanceof ArrayBuffer ? key : key.buffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data))
}
async function sha256hex(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('')
}
function hex(b: ArrayBuffer) { return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('') }

async function uploadToR2(key: string, body: string) {
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const datetime = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z'
  const contentHash = await sha256hex(body)

  const headers = `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${contentHash}\nx-amz-date:${datetime}\n`
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date'
  const canonical = `PUT\n/${R2_BUCKET}/${key}\n\n${headers}\n${signedHeaders}\n${contentHash}`
  const scope = `${date}/auto/s3/aws4_request`
  const stringToSign = `AWS4-HMAC-SHA256\n${datetime}\n${scope}\n${await sha256hex(canonical)}`

  const kDate = await hmac(new TextEncoder().encode('AWS4' + R2_SECRET_KEY), date)
  const kRegion = await hmac(kDate, 'auto')
  const kService = await hmac(kRegion, 's3')
  const kSign = await hmac(kService, 'aws4_request')
  const sig = hex(await hmac(kSign, stringToSign))

  const auth = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`
  const res = await fetch(`https://${host}/${R2_BUCKET}/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Host': host, 'x-amz-content-sha256': contentHash, 'x-amz-date': datetime, 'Authorization': auth },
    body,
  })
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status} ${await res.text()}`)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS })

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user } } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return new Response('Unauthorized', { status: 401, headers: CORS })

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return new Response('Forbidden', { status: 403, headers: CORS })

    const [notas, transferencias, comentarios, emailsLog, configs] = await Promise.all([
      supabase.from('notas_fiscais').select('*').is('deleted_at', null).then(r => r.data),
      supabase.from('transferencias').select('*').then(r => r.data),
      supabase.from('comentarios').select('*').then(r => r.data),
      supabase.from('emails_log').select('*').then(r => r.data),
      supabase.from('configs').select('*').then(r => r.data),
    ])

    const backup = { exportedAt: new Date().toISOString(), notas, transferencias, comentarios, emails_log: emailsLog, configs }
    const body = JSON.stringify(backup, null, 2)
    const nome = `backup-${new Date().toISOString().slice(0, 10)}-${Date.now()}.json`
    const r2Key = `backups/${nome}`

    await uploadToR2(r2Key, body)

    const { error } = await supabase.from('backups').insert({
      nome, r2_key: r2Key,
      tamanho_bytes: new TextEncoder().encode(body).length,
      created_by: user.id,
    })
    if (error) throw error

    return new Response(JSON.stringify({ ok: true, nome }), { headers: { 'Content-Type': 'application/json', ...CORS } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS })
  }
})
