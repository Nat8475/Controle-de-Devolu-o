import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toastStore'
import { useAuth } from '@/contexts/AuthContext'
import type { EmailLog, NotaFiscal, RespostaFornecedor } from '@/types/database'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`

// ── Log de e-mails ─────────────────────────────────────────────────────────────

export function useEmailLog() {
  return useQuery({
    queryKey: ['emails'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('emails_log')
        .select('*, profiles(nome)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as (EmailLog & { profiles: { nome: string } | null })[]
    },
  })
}

// ── Buscar notas por números de NFD ───────────────────────────────────────────

export function useBuscarNotasPorNFD() {
  return useMutation({
    mutationFn: async (nfds: string[]) => {
      if (!nfds.length) return []
      const { data, error } = await supabase
        .from('notas_fiscais')
        .select('*')
        .in('nfd', nfds)
        .is('deleted_at', null)
        .order('data', { ascending: false })
      if (error) throw error
      return data as NotaFiscal[]
    },
  })
}

// ── Verificar e-mails já enviados (duplicados) ────────────────────────────────

export function useCheckEmailDuplicado() {
  return useMutation({
    mutationFn: async (notaIds: string[]) => {
      if (!notaIds.length) return []
      const { data } = await supabase
        .from('emails_log')
        .select('nota_ids, created_at, assunto')
        .eq('status', 'enviado')
        .order('created_at', { ascending: false })

      type DupInfo = { notaId: string; count: number; lastSent: string }
      const result: DupInfo[] = []
      for (const notaId of notaIds) {
        const matches = (data ?? []).filter(log => log.nota_ids.includes(notaId))
        if (matches.length > 0) {
          result.push({ notaId, count: matches.length, lastSent: matches[0].created_at })
        }
      }
      return result
    },
  })
}

// ── Assinaturas (lista armazenada em configs, imagens no R2) ──────────────────

export interface Assinatura { nome: string; url: string }

export function useAssinaturas() {
  return useQuery({
    queryKey: ['assinaturas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configs')
        .select('valor')
        .eq('chave', 'email_assinaturas')
        .maybeSingle()
      return (data?.valor as Assinatura[]) ?? []
    },
  })
}

export function useUpdateAssinaturas() {
  const qc = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (lista: Assinatura[]) => {
      const { error } = await supabase.from('configs').upsert({
        chave: 'email_assinaturas',
        valor: lista,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assinaturas'] })
      toast('Assinaturas salvas', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })
}

// ── Destinatários padrão ───────────────────────────────────────────────────────

export function useDestinatariosPadrao() {
  return useQuery({
    queryKey: ['dest-padrao'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configs')
        .select('valor')
        .eq('chave', 'email_destinatarios_padrao')
        .maybeSingle()
      return (data?.valor as string[]) ?? []
    },
  })
}

// ── Enviar e-mail ──────────────────────────────────────────────────────────────

export interface ComunicadoAnexo { base64: string; mime: string; nome: string }

export function useSendEmail() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async (payload: {
      nota_ids: string[]
      destinatarios: string[]
      assunto: string
      corpo_html: string
      assinatura_url?: string
      comunicados?: ComunicadoAnexo[]
    }) => {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      })
      const json = await res.json() as { ok?: boolean; status?: string; error?: string; sendError?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erro ao enviar')
      return json
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['emails'] })
      toast(
        data.status === 'erro' ? `Salvo mas não enviado: ${data.sendError ?? 'erro desconhecido'}` : 'E-mail enviado',
        data.status === 'erro' ? 'err' : 'ok'
      )
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })
}

// ── Gerador de HTML do e-mail (mesmo layout do GAS) ───────────────────────────

export function gerarCorpoEmail(
  notas: NotaFiscal[],
  obs?: string,
  assinaturaUrl?: string,
): string {
  const fornecedor = notas[0]?.fornecedor ?? ''
  const total = notas.reduce((s, n) => s + (n.valor_total ?? 0), 0)
  const dataEmissao = new Date().toLocaleDateString('pt-BR')

  const tiposPrincipais = [...new Set(notas.map(n => n.tipo).filter(Boolean))]
  const tipoLabel =
    tiposPrincipais.length === 1
      ? tiposPrincipais[0] === 'Rejeição' ? 'NF REJEITADA'
        : tiposPrincipais[0] === 'Avaria'   ? 'NF AVARIADA'
        : tiposPrincipais[0] === 'Falta'    ? 'FALTA EM NF'
        : 'DEVOLUÇÃO'
      : 'DEVOLUÇÃO'

  const badgeStyle = (tipo: string | null) => {
    if (tipo === 'Rejeição') return 'background:#FEE2E2;color:#DC2626'
    if (tipo === 'Avaria')   return 'background:#FEF3C7;color:#92400E'
    if (tipo === 'Falta')    return 'background:#DBEAFE;color:#1D4ED8'
    return 'background:#F3F4F6;color:#374151'
  }

  const rows = notas.map(n => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-weight:700">${n.nfd}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB">
        <span style="${badgeStyle(n.tipo)};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">${n.tipo ?? '—'}</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:12px">${n.motivo ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB">${n.nf}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB">${n.descricao ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:center">${n.qtd}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:right;white-space:nowrap">R$&nbsp;${(n.valor_total ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:center">${new Date(n.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;font-size:13px;color:#333;max-width:720px;margin:0 auto;padding:20px;background:#fff">

  <div style="background:linear-gradient(135deg,#06101E 0%,#1C45D0 100%);color:#fff;padding:14px 18px;border-radius:8px;margin-bottom:20px">
    <div style="font-size:15px;font-weight:700">${tipoLabel} (${fornecedor.toUpperCase()})</div>
    <div style="font-size:12px;opacity:.75;margin-top:3px">Emitido em ${dataEmissao}</div>
  </div>

  <p>Prezados,</p>
  <p style="margin-top:10px">Encaminhamos abaixo a relação de notas fiscais referentes às devoluções de <strong>${fornecedor}</strong>:</p>
  ${obs ? `<p style="margin-top:10px;color:#555;font-style:italic">${obs}</p>` : ''}

  <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;border:1px solid #E5E7EB">
    <thead>
      <tr style="background:linear-gradient(135deg,#06101E 0%,#1C45D0 100%)">
        <th style="padding:8px 12px;color:#fff;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">NFD</th>
        <th style="padding:8px 12px;color:#fff;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Tipo</th>
        <th style="padding:8px 12px;color:#fff;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Motivo</th>
        <th style="padding:8px 12px;color:#fff;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Nº NF</th>
        <th style="padding:8px 12px;color:#fff;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Descrição</th>
        <th style="padding:8px 12px;color:#fff;text-align:center;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Qtd</th>
        <th style="padding:8px 12px;color:#fff;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Valor</th>
        <th style="padding:8px 12px;color:#fff;text-align:center;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Data</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="background:#EDF3FF">
        <td colspan="6" style="padding:8px 12px;text-align:right;font-weight:700;color:#1C45D0">TOTAL:</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;color:#1C45D0;white-space:nowrap">R$&nbsp;${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <p style="margin-top:20px">Atenciosamente,</p>
  ${assinaturaUrl ? `<img src="${assinaturaUrl}" alt="Assinatura" style="max-height:110px;max-width:340px;margin-top:12px;display:block">` : ''}
</body>
</html>`
}

// ── Respostas de fornecedor ────────────────────────────────────────────────────

export function useRespostasFornecedor(notaId: string | null) {
  return useQuery({
    queryKey: ['respostas', notaId],
    queryFn: async () => {
      if (!notaId) return []
      const { data, error } = await supabase
        .from('respostas_fornecedor')
        .select('*, profiles(nome)')
        .eq('nota_fiscal_id', notaId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as (RespostaFornecedor & { profiles: { nome: string } | null })[]
    },
    enabled: !!notaId,
  })
}

export function useAddResposta(notaId: string) {
  const qc = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (texto: string) => {
      if (!user) throw new Error('Não autenticado')
      const { error } = await supabase
        .from('respostas_fornecedor')
        .insert({ nota_fiscal_id: notaId, user_id: user.id, texto })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['respostas', notaId] })
      qc.invalidateQueries({ queryKey: ['nota', notaId] })
      toast('Resposta registrada', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })
}
