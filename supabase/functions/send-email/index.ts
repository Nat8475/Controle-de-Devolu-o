import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('EMAIL_FROM') ?? 'Controle de Devoluções <noreply@example.com>'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user } } = await createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!)
      .auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return new Response('Unauthorized', { status: 401, headers: CORS })

    const { nota_ids, destinatarios, assunto, corpo_html } = await req.json() as {
      nota_ids: string[]
      destinatarios: string[]
      assunto: string
      corpo_html: string
    }

    if (!destinatarios?.length || !assunto || !corpo_html) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios ausentes' }), { status: 400, headers: CORS })
    }

    let emailStatus = 'enviado'
    let enviado_em: string | null = new Date().toISOString()

    if (RESEND_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_EMAIL, to: destinatarios, subject: assunto, html: corpo_html }),
      })
      if (!res.ok) {
        emailStatus = 'erro'
        enviado_em = null
      }
    }

    const { error } = await supabase.from('emails_log').insert({
      nota_ids: nota_ids ?? [],
      destinatarios,
      assunto,
      corpo_html,
      status: emailStatus,
      enviado_em,
      created_by: user.id,
    })
    if (error) throw error

    return new Response(JSON.stringify({ ok: true, status: emailStatus }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS })
  }
})
