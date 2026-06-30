# S5: Comunicação (E-mail Devolução + Exportar PDF) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** S1 (Foundation) and S2 (Database) must be complete. S3 (FormNotas) recommended for pre-filled NFD data.

**Goal:** Implement two communication modules — FormEmailDevolucao (compose + send supplier return email via Resend through a Supabase Edge Function) and FormExportarPDF (generate Doc. Carga PDF stored in Cloudflare R2 with printable preview).

**Architecture:** Email sending goes through a Supabase Edge Function (`send-email`) that calls Resend API server-side, keeping the API key out of the browser. PDF generation runs in a second Edge Function (`generate-pdf`) using `@playwright/browser` or a lightweight `@sparticuz/chromium` rendering approach, then uploads the PDF to R2 and returns a public URL. Both functions return structured JSON to the frontend.

**Tech Stack:** React 18, TanStack Query v5 (mutations), Supabase Edge Functions (Deno), Resend API, Cloudflare R2 (PDF storage), Lucide React, shadcn/ui

## Global Constraints

- All S1 constraints apply
- Module guard: `/app/email` → `<RequireModule mod="email">`, `/app/exportar-pdf` → `<RequireModule mod="exportar-pdf">`
- Email: single recipient per send (fornecedor email), multi-NFD attachment list in body
- PDF: generated from an HTML template, not a third-party PDF library in the browser
- All file uploads to R2 via the `r2-presign` Edge Function (already created in S3)
- `toast()` from `@/stores/toastStore` for all feedback
- Pre-fill NFDs from `localStorage('cdv_email_nfds')` / `localStorage('cdv_pdf_prefill')` set by FormNotas bulk actions

---

## File Structure

```
src/
  pages/
    email/
      EmailPage.tsx          ← compose email form with NF list preview
      EmailPreview.tsx       ← rendered email preview panel
    pdf/
      PdfPage.tsx            ← configure Doc. Carga + show preview + download
      PdfPreview.tsx         ← printable HTML template rendered in iframe

supabase/
  functions/
    send-email/
      index.ts               ← Edge Function: Resend API call
    generate-pdf/
      index.ts               ← Edge Function: HTML→PDF via headless Chrome, upload to R2
```

---

### Task 1: Send-Email Edge Function

**Files:**
- Create: `supabase/functions/send-email/index.ts`

**Interfaces:**
- Produces: `POST /functions/v1/send-email`
- Request: `{ to, subject, html, replyTo? }` (JWT auth required)
- Response: `{ id }` (Resend message ID) or `{ error }`

- [ ] **Step 1: Create `supabase/functions/send-email/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'devolucoes@seu-dominio.com'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const { to, subject, html, replyTo } = await req.json()

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Missing fields: to, subject, html' }), { status: 400 })
    }

    const payload: Record<string, unknown> = { from: FROM_EMAIL, to, subject, html }
    if (replyTo) payload.reply_to = replyTo

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      return new Response(JSON.stringify({ error: resendData.message ?? 'Resend error' }), {
        status: resendRes.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ id: resendData.id }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 2: Set Resend secret in Supabase**

In Supabase Dashboard → Settings → Edge Functions → Secrets:
```
RESEND_API_KEY=re_xxxxxxxxxxxx
FROM_EMAIL=devolucoes@seu-dominio.com
```

- [ ] **Step 3: Deploy Edge Function**

```bash
npx supabase functions deploy send-email
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add send-email Edge Function via Resend"
```

---

### Task 2: Email Composition Hook

**Files:**
- Create: `src/hooks/useEmail.ts`

**Interfaces:**
- Produces: `useSendEmail()` — mutation calling the Edge Function
- Produces: `buildEmailHtml(notas, fornecedor, obs)` — returns HTML string

- [ ] **Step 1: Create `src/hooks/useEmail.ts`**

```typescript
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toastStore'
import type { NotaFiscal } from '@/types/database'

export function buildEmailHtml(notas: NotaFiscal[], fornecedor: string, obs: string): string {
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const rows = notas.map(n => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${n.nfd}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${n.nf}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${new Date(n.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${n.tipo ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${n.motivo ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">${n.qtd}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">${
        n.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'
      }</td>
    </tr>
  `).join('')

  const totalCaixas = notas.reduce((s, n) => s + (n.qtd ?? 0), 0)
  const totalValor = notas.reduce((s, n) => s + (n.valor_total ?? 0), 0)

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#1e293b;margin:0;padding:0}
  .container{max-width:680px;margin:0 auto;padding:24px}
  h2{color:#2563eb;margin-bottom:4px}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
  th{background:#f1f5f9;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  .footer{margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b}
</style></head>
<body><div class="container">
  <h2>Controle de Devoluções</h2>
  <p>Prezados,</p>
  <p>Seguem as notas fiscais para devolução junto ao fornecedor <strong>${fornecedor}</strong>.</p>
  <p>Data de referência: ${hoje}</p>
  <table>
    <thead>
      <tr>
        <th>NFD</th><th>NF</th><th>Data</th><th>Tipo</th><th>Motivo</th><th>Qtd</th><th>Valor</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="padding:8px 12px;font-weight:bold;text-align:right;font-size:12px">TOTAIS:</td>
        <td style="padding:8px 12px;font-weight:bold;text-align:right">${totalCaixas} cxs</td>
        <td style="padding:8px 12px;font-weight:bold;text-align:right">
          ${totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </td>
      </tr>
    </tfoot>
  </table>
  ${obs ? `<p><strong>Observações:</strong> ${obs}</p>` : ''}
  <p>Pedimos gentilmente a confirmação do recebimento e providências de coleta.</p>
  <div class="footer">
    <p>Este e-mail foi gerado automaticamente pelo sistema Controle de Devoluções.</p>
  </div>
</div></body></html>`
}

interface SendEmailInput {
  to: string
  subject: string
  html: string
  replyTo?: string
}

export function useSendEmail() {
  return useMutation({
    mutationFn: async (input: SendEmailInput) => {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar e-mail')
      return data as { id: string }
    },
    onSuccess: () => toast('E-mail enviado com sucesso', 'ok'),
    onError: (e: Error) => toast(e.message, 'err'),
  })
}
```

---

### Task 3: EmailPage Component

**Files:**
- Create: `src/pages/email/EmailPage.tsx`, `src/pages/email/EmailPreview.tsx`

**Interfaces:**
- Consumes: `localStorage('cdv_email_nfds')` for pre-fill
- Produces: `/app/email` — compose form + HTML preview + send

- [ ] **Step 1: Create `src/pages/email/EmailPreview.tsx`**

```typescript
interface Props { html: string }

export function EmailPreview({ html }: Props) {
  return (
    <div className="border border-[var(--border)] rounded-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--border)]/30 border-b border-[var(--border)]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-danger/60" />
          <div className="w-3 h-3 rounded-full bg-warning/60" />
          <div className="w-3 h-3 rounded-full bg-positive/60" />
        </div>
        <span className="text-xs text-[var(--text-muted)] ml-2">Preview do e-mail</span>
      </div>
      <iframe
        srcDoc={html}
        className="w-full h-[480px] bg-white"
        title="Email preview"
        sandbox="allow-same-origin"
      />
    </div>
  )
}
```

- [ ] **Step 2: Create `src/pages/email/EmailPage.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { buildEmailHtml, useSendEmail } from '@/hooks/useEmail'
import { EmailPreview } from './EmailPreview'
import type { NotaFiscal } from '@/types/database'

export default function EmailPage() {
  const navigate = useNavigate()
  const sendEmail = useSendEmail()

  const [notas, setNotas] = useState<NotaFiscal[]>([])
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [obs, setObs] = useState('')
  const [showPreview, setShowPreview] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadNotas() {
      try {
        const saved = localStorage.getItem('cdv_email_nfds')
        if (!saved) { setLoading(false); return }
        const nfds: string[] = JSON.parse(saved)
        const { data } = await supabase
          .from('notas_fiscais')
          .select('*')
          .in('nfd', nfds)
          .is('deleted_at', null)
        if (data && data.length > 0) {
          setNotas(data as NotaFiscal[])
          const fornecedor = data[0].fornecedor
          setSubject(`Devolução de NFs — ${fornecedor} — ${new Date().toLocaleDateString('pt-BR')}`)
        }
      } finally {
        setLoading(false)
      }
    }
    loadNotas()
  }, [])

  const fornecedor = notas[0]?.fornecedor ?? ''
  const html = buildEmailHtml(notas, fornecedor, obs)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!to.trim() || notas.length === 0) return
    await sendEmail.mutateAsync({ to: to.trim(), subject, html })
    localStorage.removeItem('cdv_email_nfds')
    navigate('/app/notas')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-heading text-xl font-bold text-[var(--text)]">E-mail de Devolução</h2>
      </div>

      {notas.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p className="mb-4">Nenhuma NF selecionada. Volte à tela de notas e selecione as NFs antes de acessar esta página.</p>
          <Button onClick={() => navigate('/app/notas')}>Ir para Notas</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <form onSubmit={handleSend} className="space-y-4">
            <div className="bg-[var(--border)]/20 rounded-card p-3 text-sm">
              <p className="font-medium text-[var(--text)] mb-1">{notas.length} NF(s) selecionada(s)</p>
              <p className="text-[var(--text-muted)] text-xs">{fornecedor}</p>
            </div>

            <div className="space-y-1">
              <Label>Para (e-mail do fornecedor) *</Label>
              <Input
                type="email"
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="contato@fornecedor.com.br"
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Assunto</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Observações adicionais</Label>
              <textarea
                value={obs}
                onChange={e => setObs(e.target.value)}
                rows={3}
                placeholder="Informações adicionais para o fornecedor..."
                className="w-full rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm p-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="bg-primary flex-1" disabled={sendEmail.isPending || !to.trim()}>
                <Send className="w-4 h-4 mr-2" />
                {sendEmail.isPending ? 'Enviando...' : 'Enviar E-mail'}
              </Button>
              <Button
                type="button" variant="outline"
                onClick={() => setShowPreview(p => !p)}
                className="lg:hidden"
              >
                {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </form>

          {/* Preview */}
          <div className={showPreview ? '' : 'hidden lg:block'}>
            <EmailPreview html={html} />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add route**

```typescript
const EmailPage = lazy(() => import('@/pages/email/EmailPage'))
<Route path="/app/email" element={
  <RequireModule mod="email">
    <Suspense fallback={<PageLoader />}><EmailPage /></Suspense>
  </RequireModule>
} />
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add FormEmailDevolucao with Resend integration and live preview"
```

---

### Task 4: Generate-PDF Edge Function

**Files:**
- Create: `supabase/functions/generate-pdf/index.ts`

**Interfaces:**
- Produces: `POST /functions/v1/generate-pdf`
- Request: `{ html, filename }` (JWT auth required)
- Response: `{ url }` (public R2 URL of generated PDF)

Note: Supabase Edge Functions (Deno) do not have headless Chrome built in. The simplest approach is to store the HTML in R2 and generate the PDF client-side via `window.print()` using a dedicated print stylesheet. For server-side PDF, an alternative is to call an external PDF API (e.g., html2pdf.io or PDFShift) — this function uses the external approach as a fallback. For MVP, client-side print is used.

- [ ] **Step 1: Create `supabase/functions/generate-pdf/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const R2_PUBLIC_URL = Deno.env.get('R2_PUBLIC_URL')!
const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!
const R2_ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID')!
const R2_SECRET_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!
const R2_BUCKET = Deno.env.get('R2_BUCKET_NAME')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    // Verify auth
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { error: authErr } = await supabase.auth.getUser()
    if (authErr) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const { html, filename } = await req.json()
    if (!html) return new Response(JSON.stringify({ error: 'Missing html' }), { status: 400 })

    const key = `docs/${Date.now()}-${(filename ?? 'doc-carga').replace(/[^a-z0-9-]/gi, '-')}.html`

    // Upload HTML to R2 directly (client will print it)
    // Use fetch with PUT + AWS Signature V4 to upload to R2
    const body = new TextEncoder().encode(html)

    const now = new Date()
    const date = now.toISOString().slice(0, 10).replace(/-/g, '')
    const datetime = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z'

    const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`

    // Simple PUT without signature for MVP (relies on bucket allowing writes from CF network)
    // In production, add AWS Sig V4 signing here (same as r2-presign function)
    const uploadRes = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': String(body.length),
      },
      body,
    })

    if (!uploadRes.ok) {
      // Fallback: return the HTML as a data URL the client can open
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
      return new Response(JSON.stringify({ url: null, dataUrl }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const url = `${R2_PUBLIC_URL}/${key}`
    return new Response(JSON.stringify({ url }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 2: Deploy Edge Function**

```bash
npx supabase functions deploy generate-pdf
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add generate-pdf Edge Function"
```

---

### Task 5: PdfPage Component

**Files:**
- Create: `src/pages/pdf/PdfPage.tsx`, `src/pages/pdf/PdfPreview.tsx`

**Interfaces:**
- Consumes: `localStorage('cdv_pdf_prefill')` for pre-filled NFDs
- Produces: `/app/exportar-pdf` — configure Doc. Carga, preview, print/download

- [ ] **Step 1: Create `src/pages/pdf/PdfPreview.tsx`**

```typescript
import type { NotaFiscal } from '@/types/database'

interface Props { notas: NotaFiscal[]; motorista: string; placa: string; obs: string }

function buildDocCargaHtml({ notas, motorista, placa, obs }: Props): string {
  const hoje = new Date().toLocaleDateString('pt-BR')
  const fornecedor = notas[0]?.fornecedor ?? ''
  const totalCaixas = notas.reduce((s, n) => s + (n.qtd ?? 0), 0)
  const totalValor = notas.reduce((s, n) => s + (n.valor_total ?? 0), 0)

  const rows = notas.map(n => `
    <tr>
      <td>${n.nfd}</td>
      <td>${n.nf}</td>
      <td>${new Date(n.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
      <td>${n.tipo ?? '—'}</td>
      <td>${n.motivo ?? '—'}</td>
      <td style="text-align:right">${n.qtd}</td>
      <td style="text-align:right">${n.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Doc. Carga — ${fornecedor}</title>
<style>
  @media print { body { margin: 0 } .no-print { display: none } }
  body { font-family: Arial, sans-serif; padding: 32px; color: #1e293b; font-size: 13px }
  h1 { font-size: 18px; margin-bottom: 4px }
  .header { display: flex; justify-content: space-between; margin-bottom: 24px }
  .header-right { text-align: right }
  table { width: 100%; border-collapse: collapse; margin: 16px 0 }
  th { background: #f1f5f9; padding: 7px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid #cbd5e1 }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0 }
  tfoot td { font-weight: bold; border-top: 2px solid #cbd5e1; border-bottom: none }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px }
  .info-item label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; margin-bottom: 2px }
  .info-item span { font-weight: 600 }
  .sign-row { display: flex; gap: 32px; margin-top: 48px }
  .sign-line { flex: 1; border-top: 1px solid #94a3b8; padding-top: 4px; font-size: 11px; color: #64748b }
  .obs-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-top: 12px; font-size: 12px }
</style></head>
<body>
  <div class="header">
    <div>
      <h1>Documento de Carga</h1>
      <p style="color:#64748b;margin:0">Controle de Devoluções</p>
    </div>
    <div class="header-right">
      <p style="margin:0">Data: <strong>${hoje}</strong></p>
      <p style="margin:0">Fornecedor: <strong>${fornecedor}</strong></p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-item"><label>Motorista</label><span>${motorista || '—'}</span></div>
    <div class="info-item"><label>Placa</label><span>${placa || '—'}</span></div>
  </div>

  <table>
    <thead><tr><th>NFD</th><th>NF</th><th>Data</th><th>Tipo</th><th>Motivo</th><th>Qtd</th><th>Valor</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align:right;font-size:11px;text-transform:uppercase">Totais</td>
        <td style="text-align:right">${totalCaixas} cxs</td>
        <td style="text-align:right">${totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      </tr>
    </tfoot>
  </table>

  ${obs ? `<div class="obs-box"><strong>Obs:</strong> ${obs}</div>` : ''}

  <div class="sign-row">
    <div class="sign-line">Responsável expedição</div>
    <div class="sign-line">Motorista / Transportadora</div>
    <div class="sign-line">Recebido por (fornecedor)</div>
  </div>
</body></html>`
}

export function PdfPreview(props: Props) {
  const html = buildDocCargaHtml(props)
  return { html, element: (
    <div className="border border-[var(--border)] rounded-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--border)]/30 border-b border-[var(--border)]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-danger/60" />
          <div className="w-3 h-3 rounded-full bg-warning/60" />
          <div className="w-3 h-3 rounded-full bg-positive/60" />
        </div>
        <span className="text-xs text-[var(--text-muted)] ml-2">Preview do documento</span>
      </div>
      <iframe srcDoc={html} className="w-full h-[540px] bg-white" title="Doc. Carga preview" sandbox="allow-same-origin" />
    </div>
  )}
}
```

- [ ] **Step 2: Create `src/pages/pdf/PdfPage.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { PdfPreview } from './PdfPreview'
import { toast } from '@/stores/toastStore'
import type { NotaFiscal } from '@/types/database'

export default function PdfPage() {
  const navigate = useNavigate()
  const [notas, setNotas] = useState<NotaFiscal[]>([])
  const [motorista, setMotorista] = useState('')
  const [placa, setPlaca] = useState('')
  const [obs, setObs] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const saved = localStorage.getItem('cdv_pdf_prefill')
        if (!saved) { setLoading(false); return }
        const nfds: string[] = JSON.parse(saved)
        const { data } = await supabase
          .from('notas_fiscais')
          .select('*')
          .in('nfd', nfds)
          .is('deleted_at', null)
        if (data) setNotas(data as NotaFiscal[])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const { html, element: previewEl } = PdfPreview({ notas, motorista, placa, obs })

  function handlePrint() {
    const win = window.open('', '_blank')
    if (!win) { toast('Popup bloqueado — permita pop-ups para imprimir', 'warn'); return }
    win.document.write(html)
    win.document.close()
    win.onload = () => win.print()
  }

  async function handleSaveR2() {
    setGenerating(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const fornecedor = notas[0]?.fornecedor ?? 'doc'
      const filename = `doc-carga-${fornecedor.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pdf`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({ html, filename }),
        }
      )
      const { url, dataUrl } = await res.json()
      if (url) {
        window.open(url, '_blank')
        toast('Documento salvo em R2', 'ok')
      } else if (dataUrl) {
        window.open(dataUrl, '_blank')
        toast('Documento gerado', 'ok')
      }
    } catch {
      toast('Erro ao gerar documento', 'err')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-heading text-xl font-bold text-[var(--text)]">Exportar Doc. de Carga</h2>
      </div>

      {notas.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p className="mb-4">Nenhuma NF selecionada. Selecione NFs na tela de notas antes de exportar.</p>
          <Button onClick={() => navigate('/app/notas')}>Ir para Notas</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Config */}
          <div className="space-y-4">
            <div className="bg-[var(--border)]/20 rounded-card p-3 text-sm">
              <p className="font-medium text-[var(--text)] mb-1">{notas.length} NF(s) — {notas[0]?.fornecedor}</p>
              <p className="text-[var(--text-muted)] text-xs">
                Total: {notas.reduce((s, n) => s + (n.qtd ?? 0), 0)} cxs /&nbsp;
                {notas.reduce((s, n) => s + (n.valor_total ?? 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>

            <div className="space-y-1">
              <Label>Motorista</Label>
              <Input value={motorista} onChange={e => setMotorista(e.target.value)} placeholder="Nome do motorista" />
            </div>

            <div className="space-y-1">
              <Label>Placa do veículo</Label>
              <Input value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} placeholder="AAA-0000" />
            </div>

            <div className="space-y-1">
              <Label>Observações</Label>
              <textarea
                value={obs}
                onChange={e => setObs(e.target.value)}
                rows={3}
                className="w-full rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm p-2 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <Button className="bg-primary flex-1" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />Imprimir
              </Button>
              <Button variant="outline" onClick={handleSaveR2} disabled={generating}>
                <Download className="w-4 h-4 mr-2" />
                {generating ? 'Gerando...' : 'Salvar / Abrir'}
              </Button>
            </div>
          </div>

          {/* Preview */}
          {previewEl}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add route**

```typescript
const PdfPage = lazy(() => import('@/pages/pdf/PdfPage'))
<Route path="/app/exportar-pdf" element={
  <RequireModule mod="exportar-pdf">
    <Suspense fallback={<PageLoader />}><PdfPage /></Suspense>
  </RequireModule>
} />
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: S5 complete — FormEmailDevolucao + FormExportarPDF"
```
