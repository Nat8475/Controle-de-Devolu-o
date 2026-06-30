import { useState, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Search, Send, Paperclip, X, ChevronDown, ChevronUp, Eye } from 'lucide-react'
import {
  useSendEmail,
  useBuscarNotasPorNFD,
  useAssinaturas,
  useDestinatariosPadrao,
  useCheckEmailDuplicado,
  gerarCorpoEmail,
} from '@/hooks/useEmail'
import type { NotaFiscal } from '@/types/database'
import type { ComunicadoAnexo } from '@/hooks/useEmail'

interface Props { open: boolean; onClose: () => void }

const TIPO_BADGE: Record<string, string> = {
  Rejeição: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Avaria:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Falta:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')
}

export function ComposeEmailDialog({ open, onClose }: Props) {
  // ── hooks ──────────────────────────────────────────────────────────────────
  const sendEmail           = useSendEmail()
  const buscarNotas         = useBuscarNotasPorNFD()
  const checkDuplicado      = useCheckEmailDuplicado()
  const { data: assinaturas = [] } = useAssinaturas()
  const { data: destPadrao  = [] } = useDestinatariosPadrao()

  // ── state ──────────────────────────────────────────────────────────────────
  const [nfdsInput, setNfdsInput]         = useState('')
  const [notas, setNotas]                 = useState<NotaFiscal[] | null>(null)
  const [notFound, setNotFound]           = useState<string[]>([])
  const [emailsExtras, setEmailsExtras]   = useState('')
  const [assunto, setAssunto]             = useState('')
  const [obs, setObs]                     = useState('')
  const [assinaturaUrl, setAssinaturaUrl] = useState('')
  const [comunicados, setComunicados]     = useState<(ComunicadoAnexo & { size: number; nome: string })[]>([])
  const [dupAviso, setDupAviso]           = useState<{ notaId: string; count: number; lastSent: string }[]>([])
  const [forcarEnvio, setForcarEnvio]     = useState(false)
  const [optOpen, setOptOpen]             = useState(false)
  const [previewHtml, setPreviewHtml]     = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── helpers ─────────────────────────────────────────────────────────────────
  function parseNFDs(raw: string) {
    return raw.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)
  }

  function gerarAssunto(lista: NotaFiscal[]) {
    if (!lista.length) return ''
    const forn = lista[0].fornecedor
    const tipos = [...new Set(lista.map(n => n.tipo).filter(Boolean))]
    const label = tipos.length === 1
      ? tipos[0] === 'Rejeição' ? 'NF REJEITADA'
        : tipos[0] === 'Avaria'   ? 'NF AVARIADA'
        : tipos[0] === 'Falta'    ? 'FALTA EM NF'
        : 'DEVOLUÇÃO'
      : 'DEVOLUÇÃO'
    return `${label} (${forn.toUpperCase()})`
  }

  function reset() {
    setNfdsInput(''); setNotas(null); setNotFound([])
    setEmailsExtras(''); setAssunto(''); setObs('')
    setAssinaturaUrl(''); setComunicados([])
    setDupAviso([]); setForcarEnvio(false)
    setOptOpen(false); setPreviewHtml(null)
  }

  // ── buscar NFDs ─────────────────────────────────────────────────────────────
  async function handleBuscar() {
    const nfds = parseNFDs(nfdsInput)
    if (!nfds.length) return

    setNotas(null); setDupAviso([]); setForcarEnvio(false)
    const found = await buscarNotas.mutateAsync(nfds)

    const foundNFDs = new Set(found.map(n => n.nfd))
    setNotFound(nfds.filter(n => !foundNFDs.has(n)))
    setNotas(found)

    if (found.length) {
      if (!assunto) setAssunto(gerarAssunto(found))
      // check duplicados
      const dups = await checkDuplicado.mutateAsync(found.map(n => n.id))
      setDupAviso(dups)
    }
  }

  // ── comunicados ─────────────────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    if (file.size > 8 * 1024 * 1024) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if (!allowed.includes(file.type)) return
    if (comunicados.find(c => c.nome === file.name)) return

    const reader = new FileReader()
    reader.onload = e => {
      const b64 = (e.target?.result as string).split(',')[1]
      setComunicados(prev => [...prev, { base64: b64, mime: file.type, nome: file.name, size: file.size }])
    }
    reader.readAsDataURL(file)
  }, [comunicados])

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files ?? []).forEach(processFile)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    Array.from(e.dataTransfer.files).forEach(processFile)
  }

  function removeFile(nome: string) {
    setComunicados(prev => prev.filter(c => c.nome !== nome))
  }

  // ── enviar ───────────────────────────────────────────────────────────────────
  async function handleEnviar() {
    if (!notas?.length) return

    const extras = emailsExtras.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)
    const todos = [...destPadrao, ...extras]
    if (!todos.length) return

    const corpoHtml = gerarCorpoEmail(notas, obs || undefined, assinaturaUrl || undefined)

    await sendEmail.mutateAsync({
      nota_ids: notas.map(n => n.id),
      destinatarios: todos,
      assunto,
      corpo_html: corpoHtml,
      assinatura_url: assinaturaUrl || undefined,
      comunicados: comunicados.map(({ base64, mime, nome }) => ({ base64, mime, nome })),
    })

    reset()
    onClose()
  }

  // ── preview ──────────────────────────────────────────────────────────────────
  function handlePreview() {
    if (!notas?.length) return
    setPreviewHtml(gerarCorpoEmail(notas, obs || undefined, assinaturaUrl || undefined))
  }

  // ── totais ───────────────────────────────────────────────────────────────────
  const totalValor = (notas ?? []).reduce((s, n) => s + (n.valor_total ?? 0), 0)
  const destFinal = [...destPadrao, ...emailsExtras.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)]

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto bg-surface dark:bg-surface-dark border-[var(--border)] p-0">
          {/* Header */}
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-[var(--border)]">
            <DialogTitle className="text-[var(--text)] flex items-center gap-2 text-base font-bold">
              <Send className="w-4 h-4 text-primary" />
              Enviar E-mail de Devolução
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 py-4 space-y-4">
            {/* ── Linha 1: NFDs + Destinatários ── */}
            <div className="grid grid-cols-2 gap-4">
              {/* NFDs */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-primary uppercase tracking-wide">NFDs</Label>
                <textarea
                  value={nfdsInput}
                  onChange={e => setNfdsInput(e.target.value)}
                  rows={5}
                  placeholder={'Ex:\n1364123\n1364124\nou: 1364123, 1364124'}
                  className="w-full rounded-btn border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] text-sm p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              {/* Destinatários */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-primary uppercase tracking-wide">Destinatários</Label>
                {destPadrao.length > 0 && (
                  <div className="rounded-btn border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 px-3 py-2 text-xs text-green-800 dark:text-green-300">
                    <strong>Padrão:</strong> {destPadrao.join(', ')}
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-[var(--text-muted)]">
                    E-mails extras <span className="font-normal opacity-70">(opcional)</span>
                  </Label>
                  <Input
                    value={emailsExtras}
                    onChange={e => setEmailsExtras(e.target.value)}
                    placeholder="ex@email.com; outro@email.com"
                    className="text-sm"
                  />
                </div>
                {destFinal.length > 0 && (
                  <p className="text-xs text-[var(--text-muted)]">
                    {destFinal.length} destinatário(s) no total
                  </p>
                )}
              </div>
            </div>

            {/* ── Botão buscar ── */}
            <Button
              onClick={handleBuscar}
              disabled={!nfdsInput.trim() || buscarNotas.isPending || checkDuplicado.isPending}
              className="w-full bg-primary gap-2"
            >
              <Search className="w-4 h-4" />
              {buscarNotas.isPending ? 'Buscando...' : 'Buscar e Pré-visualizar'}
            </Button>

            {/* ── NFDs não encontradas ── */}
            {notFound.length > 0 && (
              <div className="rounded-btn border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                <strong>NFDs não encontradas:</strong> {notFound.join(', ')}
              </div>
            )}

            {/* ── Aviso de duplicados ── */}
            {dupAviso.length > 0 && !forcarEnvio && (
              <div className="rounded-btn border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  E-mail já enviado para {dupAviso.length} NFD(s)
                </div>
                {dupAviso.map(d => (
                  <p key={d.notaId} className="text-xs text-amber-700 dark:text-amber-400 pl-6">
                    • {d.count} vez(es) — último em {new Date(d.lastSent).toLocaleString('pt-BR')}
                  </p>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-400 text-amber-800 hover:bg-amber-100 text-xs"
                  onClick={() => setForcarEnvio(true)}
                >
                  Enviar mesmo assim
                </Button>
              </div>
            )}

            {/* ── Tabela de preview ── */}
            {notas && notas.length > 0 && (
              <div className="rounded-btn border border-[var(--border)] overflow-hidden">
                <div className="bg-primary/10 dark:bg-primary/20 px-4 py-2 text-xs font-bold text-primary uppercase tracking-wide">
                  Pré-visualização — {notas.length} NFD(s)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#06101E] text-white">
                        {['NFD','Tipo','Motivo','Nº NF','Descrição','Qtd','Valor','Data'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold uppercase text-[10px] tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {notas.map(n => (
                        <tr key={n.id} className="border-b border-[var(--border)] hover:bg-[var(--border)]/20">
                          <td className="px-3 py-2 font-bold">{n.nfd}</td>
                          <td className="px-3 py-2">
                            <Badge className={`text-[10px] font-bold border-0 ${TIPO_BADGE[n.tipo ?? ''] ?? 'bg-gray-100 text-gray-700'}`}>
                              {n.tipo ?? '—'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-[var(--text-muted)] max-w-[140px] truncate">{n.motivo ?? '—'}</td>
                          <td className="px-3 py-2">{n.nf}</td>
                          <td className="px-3 py-2 max-w-[120px] truncate">{n.descricao ?? '—'}</td>
                          <td className="px-3 py-2 text-center">{n.qtd}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap font-mono">R$ {formatBRL(n.valor_total ?? 0)}</td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">{formatDate(n.data)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-primary/10 dark:bg-primary/20">
                        <td colSpan={6} className="px-3 py-2 text-right font-bold text-primary text-xs uppercase tracking-wide">Total:</td>
                        <td className="px-3 py-2 text-right font-bold text-primary font-mono whitespace-nowrap">R$ {formatBRL(totalValor)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {notas && notas.length === 0 && (
              <p className="text-sm text-center text-[var(--text-muted)] py-4">Nenhuma NFD encontrada com os números informados.</p>
            )}

            {/* ── Comunicado (anexo) ── */}
            {notas && notas.length > 0 && (
              <div className="rounded-btn border border-[var(--border)] overflow-hidden">
                <div className="px-4 py-2.5 flex items-center gap-2 bg-surface dark:bg-surface-dark">
                  <Paperclip className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-sm font-semibold text-[var(--text)]">Comunicado de retorno</span>
                  <span className="text-xs text-[var(--text-muted)] ml-1">(opcional)</span>
                </div>
                <div className="px-4 pb-3 space-y-2">
                  <div
                    className={`border-2 border-dashed rounded-btn p-4 text-center cursor-pointer text-xs transition-colors ${
                      comunicados.length ? 'border-green-300 bg-green-50 dark:bg-green-900/10 text-green-700' : 'border-[var(--border-def)] hover:border-primary hover:bg-primary/5 text-[var(--text-muted)]'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={onDrop}
                  >
                    {comunicados.length
                      ? `+ Clique para mais arquivos (${comunicados.length} selecionado${comunicados.length > 1 ? 's' : ''})`
                      : 'Clique ou arraste PDF, JPG ou PNG aqui (máx. 8 MB por arquivo)'}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    className="hidden"
                    onChange={onFilePick}
                  />
                  {comunicados.map(c => (
                    <div key={c.nome} className="flex items-center gap-2 rounded-btn border border-[var(--border)] px-3 py-2 text-xs">
                      <Paperclip className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                      <span className="flex-1 truncate text-[var(--text)]">{c.nome}</span>
                      <span className="text-[var(--text-muted)]">
                        {c.size < 1048576 ? `${Math.round(c.size / 1024)} KB` : `${(c.size / 1048576).toFixed(1)} MB`}
                      </span>
                      <button onClick={() => removeFile(c.nome)} className="text-red-500 hover:text-red-700 p-0.5">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Opções colapsáveis ── */}
            {notas && notas.length > 0 && (
              <div className="rounded-btn border border-[var(--border)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOptOpen(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-[var(--text)] bg-surface dark:bg-surface-dark hover:bg-[var(--border)]/20 transition-colors"
                >
                  <span>Assunto, assinatura e observações</span>
                  {optOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {optOpen && (
                  <div className="px-4 pb-4 pt-3 space-y-3 border-t border-[var(--border)]">
                    <div className="space-y-1">
                      <Label className="text-xs">Assunto <span className="font-normal text-[var(--text-muted)]">(gerado automaticamente)</span></Label>
                      <Input value={assunto} onChange={e => setAssunto(e.target.value)} className="text-sm" />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Assinatura <span className="font-normal text-[var(--text-muted)]">(opcional)</span></Label>
                      {assinaturas.length > 0 ? (
                        <select
                          value={assinaturaUrl}
                          onChange={e => setAssinaturaUrl(e.target.value)}
                          className="w-full rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-3 py-2"
                        >
                          <option value="">— Sem assinatura —</option>
                          {assinaturas.map(a => (
                            <option key={a.url} value={a.url}>{a.nome}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-[var(--text-muted)]">
                          Nenhuma assinatura cadastrada. Adicione em Configurações → Assinaturas.
                        </p>
                      )}
                      {assinaturaUrl && (
                        <img
                          src={assinaturaUrl}
                          alt="Preview assinatura"
                          className="mt-2 max-h-16 max-w-[260px] rounded border border-[var(--border)] object-contain p-1"
                        />
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Observações <span className="font-normal text-[var(--text-muted)]">(opcional)</span></Label>
                      <textarea
                        value={obs}
                        onChange={e => setObs(e.target.value)}
                        rows={2}
                        placeholder="Texto adicional que aparece no corpo do e-mail..."
                        className="w-full rounded-btn border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] text-sm p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Ações ── */}
            <div className="flex gap-2 pt-1">
              {notas && notas.length > 0 && (
                <Button variant="outline" onClick={handlePreview} className="gap-1.5 flex-shrink-0">
                  <Eye className="w-4 h-4" />
                  Preview HTML
                </Button>
              )}
              <Button variant="outline" onClick={() => { reset(); onClose() }} className="flex-1">
                Cancelar
              </Button>
              {notas && notas.length > 0 && (dupAviso.length === 0 || forcarEnvio) && (
                <Button
                  onClick={handleEnviar}
                  disabled={sendEmail.isPending || !destFinal.length}
                  className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                >
                  <Send className="w-4 h-4" />
                  {sendEmail.isPending ? 'Enviando...' : 'Confirmar e Enviar'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal preview HTML ── */}
      {previewHtml && (
        <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="px-5 pt-4 pb-3 border-b border-[var(--border)] flex-shrink-0">
              <DialogTitle className="text-sm flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Preview do E-mail
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-full border-none min-h-[500px]"
                title="Preview e-mail"
                sandbox="allow-same-origin"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
