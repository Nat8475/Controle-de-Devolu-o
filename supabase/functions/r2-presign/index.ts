import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!
const R2_ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID')!
const R2_SECRET_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!
const R2_BUCKET = Deno.env.get('R2_BUCKET_NAME')!
const R2_PUBLIC_URL = Deno.env.get('R2_PUBLIC_URL')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key instanceof ArrayBuffer ? key : key.buffer,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
}

async function sha256hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const { fileName, contentType, folder } = await req.json()
    const r2Key = `${folder}/${Date.now()}-${fileName}`
    const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

    const now = new Date()
    const date = now.toISOString().slice(0, 10).replace(/-/g, '')
    const datetime = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z'

    const credential = `${R2_ACCESS_KEY}/${date}/auto/s3/aws4_request`

    const params = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': credential,
      'X-Amz-Date': datetime,
      'X-Amz-Expires': '3600',
      'X-Amz-SignedHeaders': 'host',
    })

    const canonicalRequest = [
      'PUT',
      `/${R2_BUCKET}/${r2Key}`,
      params.toString(),
      `host:${host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n')

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      datetime,
      `${date}/auto/s3/aws4_request`,
      await sha256hex(canonicalRequest),
    ].join('\n')

    const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + R2_SECRET_KEY), date)
    const kRegion = await hmacSha256(kDate, 'auto')
    const kService = await hmacSha256(kRegion, 's3')
    const kSigning = await hmacSha256(kService, 'aws4_request')
    const signature = bufToHex(await hmacSha256(kSigning, stringToSign))

    params.set('X-Amz-Signature', signature)

    const uploadUrl = `https://${host}/${R2_BUCKET}/${r2Key}?${params.toString()}`
    const publicUrl = `${R2_PUBLIC_URL}/${r2Key}`

    return new Response(JSON.stringify({ uploadUrl, publicUrl, r2Key }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS })
  }
})
