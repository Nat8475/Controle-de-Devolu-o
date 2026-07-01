import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import {
  X, Save, ArrowRightLeft, ShoppingCart, RefreshCw, Send, Mail,
  Tag, Printer, CheckCircle2, ChevronLeft, ChevronRight, Pencil,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useNotaDetail, useNotasMutation } from '@/hooks/useNotas'
import { useComentariosMutation, useNotaTransferencias, useTransferenciasMutation } from '@/hooks/useTransferencias'
import { useAddResposta, useRespostasFornecedor } from '@/hooks/useEmail'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TransferenciaDialog } from './TransferenciaDialog'
import { ComposeEmailDialog } from '@/pages/email/ComposeEmailDialog'
import { FotoUpload } from '@/pages/lancamento/FotoUpload'
import type { EmailLog, AuditLog, FreteTipo, SupabaseStatus } from '@/types/database'

const STATUS_OPTIONS: SupabaseStatus[] = ['Pendente', 'Em Transferência', 'Devolvido', 'Cancelado', 'Vendido']
const FRETE_TIPOS: FreteTipo[] = ['Tabela', 'Valor+ICMS', 'Valor', 'Cortesia']
const STATUS_BADGE: Record<SupabaseStatus, string> = {
  'Pendente': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Em Transferência': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Devolvido': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Cancelado': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'Vendido': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
}

// ── Hooks inline (histórico de e-mails e log de auditoria da nota) ────────────

function useNotaEmails(notaId: string | null) {
  return useQuery({
    queryKey: ['nota-emails', notaId],
    queryFn: async () => {
      if (!notaId) return []
      const { data, error } = await supabase
        .from('emails_log')
        .select('*')
        .contains('nota_ids', [notaId])
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as EmailLog[]
    },
    enabled: !!notaId,
  })
}

function useNotaAuditLog(notaId: string | null) {
  return useQuery({
    queryKey: ['nota-audit', notaId],
    queryFn: async () => {
      if (!notaId) return []
      const { data, error } = await supabase
        .from('audit_log')
        .select('*, profiles(nome)')
        .eq('registro_id', notaId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data as (AuditLog & { profiles: { nome: string } | null })[]
    },
    enabled: !!notaId,
  })
}

const EMAIL_STATUS_BADGE: Record<string, string> = {
  enviado: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  agendado: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  erro: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

interface Props { id: string | null; onClose: () => void }

export function NotaDetail({ id, onClose }: Props) {
  const { data: nota, isLoading } = useNotaDetail(id)
  const { updateNota } = useNotasMutation()
  const { data: transferencias = [] } = useNotaTransferencias(id)
  const { updateTransferencia } = useTransferenciasMutation()
  const addComentario = useComentariosMutation(id ?? '')
  const qc = useQueryClient()

  const [obs, setObs] = useState('')
  const [freteTipo, setFreteTipo] = useState<FreteTipo | ''>('')
  const [freteValor, setFreteValor] = useState('')
  const { data: respostas = [] } = useRespostasFornecedor(id)
  const addResposta = useAddResposta(id ?? '')
  const { data: notaEmails = [] } = useNotaEmails(id)
  const { data: auditEntries = [] } = useNotaAuditLog(id)

  const [tfOpen, setTfOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [comentarioTxt, setComentarioTxt] = useState('')
  const [respostaTxt, setRespostaTxt] = useState('')
  const [etiquetaOpen, setEtiquetaOpen] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  // Edição inline dos campos base
  const [editMode, setEditMode] = useState(false)
  const [editFields, setEditFields] = useState({
    nf: '', data: '', fornecedor: '', tipo: '', motivo: '', qtd: '', valor_unitario: '',
  })

  if (nota) {
    if (obs === '' && nota.obs) setObs(nota.obs)
    if (freteTipo === '' && nota.frete_tipo) setFreteTipo(nota.frete_tipo)
    if (freteValor === '' && nota.frete_valor != null) setFreteValor(String(nota.frete_valor))
  }

  function startEdit() {
    if (!nota) return
    setEditFields({
      nf: nota.nf ?? '',
      data: nota.data ?? '',
      fornecedor: nota.fornecedor ?? '',
      tipo: nota.tipo ?? '',
      motivo: nota.motivo ?? '',
      qtd: String(nota.qtd ?? ''),
      valor_unitario: String(nota.valor_unitario ?? ''),
    })
    setEditMode(true)
  }

  function handleSaveEdit() {
    if (!nota) return
    updateNota.mutate({
      id: nota.id,
      data: {
        nf: editFields.nf,
        data: editFields.data,
        fornecedor: editFields.fornecedor,
        tipo: editFields.tipo || null,
        motivo: editFields.motivo || null,
        qtd: editFields.qtd ? Number(editFields.qtd) : nota.qtd,
        valor_unitario: editFields.valor_unitario ? parseFloat(editFields.valor_unitario) : nota.valor_unitario,
      },
    })
    setEditMode(false)
  }

  function handleConfirmarRecebimento() {
    if (!nota) return
    if (!window.confirm('Confirmar recebimento da mercadoria pelo fornecedor?')) return
    addComentario.mutate('✅ Recebimento confirmado pelo fornecedor')
  }

  async function handleFotosUploaded(novas: Array<{ url: string; r2Key: string }>) {
    if (!nota || novas.length === 0) return
    const jaSalvas = new Set((fotos ?? []).map(f => f.url))
    const aInserir = novas.filter(f => !jaSalvas.has(f.url))
    if (aInserir.length === 0) return
    const baseOrdem = fotos?.length ?? 0
    const { error } = await supabase.from('fotos_nf').insert(
      aInserir.map((f, i) => ({
        nota_fiscal_id: nota.id,
        url: f.url,
        r2_key: f.r2Key,
        nome: f.r2Key.split('/').pop() ?? f.r2Key,
        ordem: baseOrdem + i,
      }))
    )
    if (!error) {
      qc.invalidateQueries({ queryKey: ['nota', nota.id] })
    }
  }

  function handleSaveObs() {
    if (!nota) return
    updateNota.mutate({ id: nota.id, data: { obs } })
  }

  function handleSaveFrete() {
    if (!nota) return
    updateNota.mutate({
      id: nota.id,
      data: {
        frete_tipo: freteTipo || null,
        frete_valor: freteValor ? parseFloat(freteValor) : null,
      },
    })
  }

  function handleVenda() {
    if (!nota) return
    if (window.confirm(`Marcar NFD ${nota.nfd} como Vendido?`)) {
      updateNota.mutate({ id: nota.id, data: { status: 'Vendido' } })
    }
  }

  function handleReabrir() {
    if (!nota) return
    updateNota.mutate({ id: nota.id, data: { status: 'Pendente' } })
  }

  async function handleComentario(e: React.FormEvent) {
    e.preventDefault()
    if (!comentarioTxt.trim()) return
    await addComentario.mutateAsync(comentarioTxt.trim())
    setComentarioTxt('')
  }

  const comentarios = (nota as Record<string, unknown>)?.comentarios as Array<{
    id: string; texto: string; created_at: string; profiles: { nome: string } | null
  }> | undefined

  const fotos = (nota as Record<string, unknown>)?.fotos_nf as Array<{
    id: string; url: string; nome: string
  }> | undefined

  return (
    <AnimatePresence>
      {id && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-surface dark:bg-surface-dark shadow-soft-lg z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <h3 className="font-heading font-semibold text-[var(--text)]">
                  {nota ? `NFD ${nota.nfd}` : 'Carregando...'}
                </h3>
                {nota && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[nota.status as SupabaseStatus]}`}>
                    {nota.status}
                  </span>
                )}
              </div>
              <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : nota ? (
              <>
                <div className="flex gap-2 px-6 pt-3 pb-1 border-b border-[var(--border)]">
                  <Button size="sm" variant="outline" onClick={() => setTfOpen(true)} className="text-xs gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5" />Transferência
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleVenda} className="text-xs gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5" />Venda
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)} className="text-xs gap-1.5">
                    <Mail className="w-3.5 h-3.5" />E-mail
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEtiquetaOpen(true)} className="text-xs gap-1.5">
                    <Tag className="w-3.5 h-3.5" />Etiqueta/QR
                  </Button>
                  {nota.status === 'Devolvido' && (
                    <Button size="sm" variant="outline" onClick={handleConfirmarRecebimento} className="text-xs gap-1.5 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />Confirmar Recebimento
                    </Button>
                  )}
                  {nota.status !== 'Pendente' && (
                    <Button size="sm" variant="outline" onClick={handleReabrir} className="text-xs gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" />Reabrir
                    </Button>
                  )}
                </div>

                <Tabs defaultValue="detalhes" className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="mx-6 mt-3 mb-0 w-fit">
                    <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                    <TabsTrigger value="transferencias">
                      Transferências {transferencias.length > 0 && `(${transferencias.length})`}
                    </TabsTrigger>
                    <TabsTrigger value="comentarios">
                      Comentários {comentarios && comentarios.length > 0 && `(${comentarios.length})`}
                    </TabsTrigger>
                    <TabsTrigger value="respostas">
                      Fornecedor {respostas.length > 0 && `(${respostas.length})`}
                    </TabsTrigger>
                    <TabsTrigger value="emails">
                      E-mails {notaEmails.length > 0 && `(${notaEmails.length})`}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="detalhes" className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 mt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">Dados da nota</p>
                      {!editMode ? (
                        <Button size="sm" variant="outline" onClick={startEdit} className="text-xs gap-1.5">
                          <Pencil className="w-3 h-3" />Editar
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditMode(false)} className="text-xs">
                            Cancelar
                          </Button>
                          <Button size="sm" className="bg-primary text-xs" onClick={handleSaveEdit} disabled={updateNota.isPending}>
                            <Save className="w-3 h-3 mr-1" />Salvar alterações
                          </Button>
                        </div>
                      )}
                    </div>

                    {!editMode ? (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {([
                          ['NFD', nota.nfd], ['NF', nota.nf],
                          ['Data', new Date(nota.data + 'T00:00:00').toLocaleDateString('pt-BR')],
                          ['Fornecedor', nota.fornecedor],
                          ['Tipo', nota.tipo], ['Motivo', nota.motivo],
                          ['Quantidade', nota.qtd],
                          ['Valor Unit.', nota.valor_unitario?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
                          ['Valor Total', nota.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
                        ] as [string, unknown][]).map(([label, value]) => (
                          <div key={label}>
                            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{label}</p>
                            <p className="font-medium text-[var(--text)]">{value != null ? String(value) : '—'}</p>
                          </div>
                        ))}
                        <div>
                          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">Status</p>
                          <select
                            value={nota.status}
                            onChange={e => updateNota.mutate({ id: nota.id, data: { status: e.target.value as SupabaseStatus } })}
                            className="rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-2 py-1"
                          >
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <Label className="text-xs uppercase text-[var(--text-muted)]">NFD</Label>
                          <p className="font-medium text-[var(--text)] mt-1.5">{nota.nfd}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs uppercase text-[var(--text-muted)]">NF</Label>
                          <Input value={editFields.nf} onChange={e => setEditFields(f => ({ ...f, nf: e.target.value }))} className="text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs uppercase text-[var(--text-muted)]">Data</Label>
                          <Input type="date" value={editFields.data} onChange={e => setEditFields(f => ({ ...f, data: e.target.value }))} className="text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs uppercase text-[var(--text-muted)]">Fornecedor</Label>
                          <Input value={editFields.fornecedor} onChange={e => setEditFields(f => ({ ...f, fornecedor: e.target.value }))} className="text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs uppercase text-[var(--text-muted)]">Tipo</Label>
                          <Input value={editFields.tipo} onChange={e => setEditFields(f => ({ ...f, tipo: e.target.value }))} className="text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs uppercase text-[var(--text-muted)]">Motivo</Label>
                          <Input value={editFields.motivo} onChange={e => setEditFields(f => ({ ...f, motivo: e.target.value }))} className="text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs uppercase text-[var(--text-muted)]">Quantidade</Label>
                          <Input type="number" value={editFields.qtd} onChange={e => setEditFields(f => ({ ...f, qtd: e.target.value }))} className="text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs uppercase text-[var(--text-muted)]">Valor Unit.</Label>
                          <Input type="number" step="0.01" value={editFields.valor_unitario} onChange={e => setEditFields(f => ({ ...f, valor_unitario: e.target.value }))} className="text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs uppercase text-[var(--text-muted)]">Valor Total</Label>
                          <p className="font-medium text-[var(--text)] mt-1.5">
                            {nota.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs uppercase text-[var(--text-muted)]">Status</Label>
                          <select
                            value={nota.status}
                            onChange={e => updateNota.mutate({ id: nota.id, data: { status: e.target.value as SupabaseStatus } })}
                            className="w-full mt-1.5 rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-2 py-1.5"
                          >
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="border border-[var(--border)] rounded-btn p-3 space-y-3">
                      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">Frete</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Tipo</Label>
                          <select
                            value={freteTipo}
                            onChange={e => setFreteTipo(e.target.value as FreteTipo)}
                            className="w-full rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-2 py-1.5"
                          >
                            <option value="">— sem frete —</option>
                            {FRETE_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Valor (R$)</Label>
                          <Input
                            type="number" step="0.01"
                            value={freteValor}
                            onChange={e => setFreteValor(e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={handleSaveFrete} className="text-xs">
                        <Save className="w-3 h-3 mr-1.5" />Salvar frete
                      </Button>
                    </div>

                    {nota.descricao && (
                      <div>
                        <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Descrição</p>
                        <p className="text-sm text-[var(--text)]">{nota.descricao}</p>
                      </div>
                    )}

                    <div>
                      <Label className="text-xs uppercase text-[var(--text-muted)]">Observações</Label>
                      <textarea
                        value={obs}
                        onChange={e => setObs(e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm p-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <Button size="sm" className="mt-2 bg-primary" onClick={handleSaveObs}>
                        <Save className="w-3.5 h-3.5 mr-1" />Salvar obs.
                      </Button>
                    </div>

                    {fotos && fotos.length > 0 && (
                      <div>
                        <p className="text-xs text-[var(--text-muted)] uppercase mb-2">Fotos de Avaria</p>
                        <div className="grid grid-cols-3 gap-2">
                          {fotos.map((f, i) => (
                            <button key={f.id} type="button" onClick={() => setLightboxIdx(i)}>
                              <img src={f.url} alt={f.nome} className="w-full h-20 object-cover rounded-btn hover:opacity-90 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-xs text-[var(--text-muted)] uppercase mb-2">Adicionar fotos</p>
                      <FotoUpload folder={`notas/${nota.aba}/${nota.nfd}`} onUploaded={handleFotosUploaded} />
                    </div>

                    <div className="border-t border-[var(--border)] pt-3">
                      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium mb-2">Histórico de ações</p>
                      {auditEntries.length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)] py-2">Nenhuma ação registrada.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {auditEntries.map(a => (
                            <div key={a.id} className="flex items-center justify-between text-xs">
                              <span className="text-[var(--text)]">
                                <span className="font-medium">{a.profiles?.nome ?? 'Sistema'}</span> — {a.acao}
                              </span>
                              <span className="text-[var(--text-muted)]">
                                {new Date(a.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="transferencias" className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 mt-3">
                    <Button size="sm" className="bg-primary gap-1.5" onClick={() => setTfOpen(true)}>
                      <ArrowRightLeft className="w-3.5 h-3.5" />Nova Transferência
                    </Button>
                    {transferencias.length === 0 ? (
                      <p className="text-sm text-[var(--text-muted)] py-4 text-center">Nenhuma transferência registrada.</p>
                    ) : (
                      <div className="space-y-2">
                        {transferencias.map(tf => (
                          <div key={tf.id} className="border border-[var(--border)] rounded-btn p-3 text-sm space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                tf.status === 'Ativa' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                tf.status === 'Concluída' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                              }`}>{tf.status}</span>
                              <span className="text-xs text-[var(--text-muted)]">
                                {new Date(tf.created_at).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                              {tf.tipo && <span>Tipo: <span className="text-[var(--text)]">{tf.tipo}</span></span>}
                              {tf.caixas != null && <span>Caixas: <span className="text-[var(--text)]">{tf.caixas}</span></span>}
                              {tf.valor != null && <span>Valor: <span className="text-[var(--text)]">{tf.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>}
                              {tf.num_pedido && <span>Pedido: <span className="text-[var(--text)]">{tf.num_pedido}</span></span>}
                              {tf.agendamento && <span>Agend.: <span className="text-[var(--text)]">{new Date(tf.agendamento + 'T00:00:00').toLocaleDateString('pt-BR')}</span></span>}
                            </div>
                            {tf.status === 'Ativa' && (
                              <div className="flex gap-2 pt-1">
                                <Button size="sm" variant="outline" className="text-xs h-6 px-2"
                                  onClick={() => updateTransferencia.mutate({ id: tf.id, status: 'Concluída' })}>
                                  Concluir
                                </Button>
                                <Button size="sm" variant="outline" className="text-xs h-6 px-2 text-red-600 hover:text-red-700"
                                  onClick={() => updateTransferencia.mutate({ id: tf.id, status: 'Cancelada' })}>
                                  Cancelar
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="comentarios" className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col mt-3">
                    <div className="flex-1 space-y-3 mb-4">
                      {!comentarios || comentarios.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)] py-4 text-center">Nenhum comentário ainda.</p>
                      ) : (
                        comentarios.map(c => (
                          <div key={c.id} className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[var(--text)]">{c.profiles?.nome ?? 'Usuário'}</span>
                              <span className="text-xs text-[var(--text-muted)]">
                                {new Date(c.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                            <p className="text-sm text-[var(--text)] bg-[var(--border)]/40 rounded-btn px-3 py-2">{c.texto}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <form onSubmit={handleComentario} className="flex gap-2">
                      <input
                        value={comentarioTxt}
                        onChange={e => setComentarioTxt(e.target.value)}
                        placeholder="Adicionar comentário..."
                        className="flex-1 rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <Button type="submit" size="sm" className="bg-primary" disabled={addComentario.isPending}>
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="respostas" className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col mt-3">
                    <p className="text-xs text-[var(--text-muted)] mb-3">Registre respostas e posições recebidas do fornecedor.</p>
                    <div className="flex-1 space-y-3 mb-4">
                      {respostas.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)] py-4 text-center">Nenhuma resposta registrada.</p>
                      ) : (
                        respostas.map(r => (
                          <div key={r.id} className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[var(--text)]">{r.profiles?.nome ?? 'Usuário'}</span>
                              <span className="text-xs text-[var(--text-muted)]">
                                {new Date(r.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                            <p className="text-sm text-[var(--text)] bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-btn px-3 py-2">{r.texto}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <form onSubmit={async e => {
                      e.preventDefault()
                      if (!respostaTxt.trim()) return
                      await addResposta.mutateAsync(respostaTxt.trim())
                      setRespostaTxt('')
                    }} className="flex gap-2">
                      <input
                        value={respostaTxt}
                        onChange={e => setRespostaTxt(e.target.value)}
                        placeholder="Registrar resposta do fornecedor..."
                        className="flex-1 rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <Button type="submit" size="sm" className="bg-primary" disabled={addResposta.isPending}>
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="emails" className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 mt-3">
                    {notaEmails.length === 0 ? (
                      <p className="text-sm text-[var(--text-muted)] py-4 text-center">Nenhum e-mail enviado para esta nota.</p>
                    ) : (
                      <div className="space-y-2">
                        {notaEmails.map(e => (
                          <div key={e.id} className="border border-[var(--border)] rounded-btn p-3 text-sm space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-[var(--text)]">{e.assunto ?? '(sem assunto)'}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EMAIL_STATUS_BADGE[e.status] ?? ''}`}>
                                {e.status}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)]">
                              Para: {e.destinatarios?.join(', ') || '—'}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {e.enviado_em
                                ? new Date(e.enviado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                                : new Date(e.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <TransferenciaDialog nota={nota as Parameters<typeof TransferenciaDialog>[0]['nota']} open={tfOpen} onClose={() => setTfOpen(false)} />
                <ComposeEmailDialog open={emailOpen} onClose={() => setEmailOpen(false)} />

                {/* Etiqueta / QR Code */}
                <Dialog open={etiquetaOpen} onOpenChange={setEtiquetaOpen}>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Etiqueta da caixa</DialogTitle>
                    </DialogHeader>
                    <div id="etiqueta-print" className="flex flex-col items-center gap-4 py-2">
                      <QRCodeSVG
                        value={`NFD:${nota.nfd}|NF:${nota.nf}|Fornecedor:${nota.fornecedor}`}
                        size={180}
                      />
                      <div className="w-full text-sm space-y-1 text-center">
                        <p className="font-semibold text-[var(--text)] text-base">NFD {nota.nfd}</p>
                        <p className="text-[var(--text)]">NF: {nota.nf}</p>
                        <p className="text-[var(--text)]">Fornecedor: {nota.fornecedor}</p>
                        <p className="text-[var(--text)]">Data: {new Date(nota.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                        <p className="text-[var(--text)]">Qtd: {nota.qtd}</p>
                      </div>
                    </div>
                    <Button size="sm" className="bg-primary gap-1.5 w-full" onClick={() => window.print()}>
                      <Printer className="w-3.5 h-3.5" />Imprimir
                    </Button>
                  </DialogContent>
                </Dialog>

                {/* Lightbox de fotos */}
                <Dialog open={lightboxIdx !== null} onOpenChange={open => !open && setLightboxIdx(null)}>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        Foto {lightboxIdx != null ? lightboxIdx + 1 : 0} de {fotos?.length ?? 0}
                      </DialogTitle>
                    </DialogHeader>
                    {fotos && lightboxIdx != null && fotos[lightboxIdx] && (
                      <div className="flex flex-col items-center gap-3">
                        <img
                          src={fotos[lightboxIdx].url}
                          alt={fotos[lightboxIdx].nome}
                          className="max-h-[60vh] w-auto object-contain rounded-btn"
                        />
                        {fotos.length > 1 && (
                          <div className="flex items-center justify-between w-full">
                            <Button
                              size="sm" variant="outline" className="gap-1.5"
                              onClick={() => setLightboxIdx(i => (i! - 1 + fotos.length) % fotos.length)}
                            >
                              <ChevronLeft className="w-4 h-4" />Anterior
                            </Button>
                            <Button
                              size="sm" variant="outline" className="gap-1.5"
                              onClick={() => setLightboxIdx(i => (i! + 1) % fotos.length)}
                            >
                              Próxima<ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </>
            ) : null}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
