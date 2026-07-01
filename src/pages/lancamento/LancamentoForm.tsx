import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { XmlImporter } from './XmlImporter'
import { FotoUpload } from './FotoUpload'
import { DuplicateError, useFornecedoresVariados, useLancamento, type LancamentoData } from '@/hooks/useLancamento'
import { usePermission } from '@/hooks/usePermission'
import { toast } from '@/stores/toastStore'
import type { SupabaseAba } from '@/types/database'

const DRAFT_KEY = 'cdv_draft_lancamento'

const MOTIVOS_PADRAO = [
  'MEDIDAS FORA DA TOLERÂNCIA',
  'EMBALAGEM AVARIADA',
  'PRODUTO ERRADO',
  'QUANTIDADE INCORRETA',
  'VALIDADE VENCIDA',
  'PRODUTO SEM REGISTRO',
  'NF COM ERRO',
  'FALTA DE DOCUMENTAÇÃO',
  'DIVERGÊNCIA DE PREÇO',
  'PRODUTO IMPRÓPRIO PARA CONSUMO',
  'SOBRA DE ESTOQUE',
  'DEVOLUÇÃO COMERCIAL',
]

const EMPTY_FORM = {
  nfd: '', nf: '', data: '', fornecedor: '', aba: 'Britania' as SupabaseAba,
  tipo: '', motivo: '', descricao: '', qtd: '', valor_unitario: '', obs: '',
}

type FormState = typeof EMPTY_FORM

export function LancamentoForm() {
  const navigate = useNavigate()
  const { insertNota } = useLancamento()
  const { hasModule } = usePermission()
  const podeEscrever = hasModule('lancamento')

  const [form, setForm] = useState<FormState>(() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '') as FormState } catch { return EMPTY_FORM }
  })
  const [fotos, setFotos] = useState<Array<{ url: string; r2Key: string }>>([])
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [duplicateInfo, setDuplicateInfo] = useState<{ nf: string; aba: SupabaseAba } | null>(null)
  const pendingSubmit = useRef<{ data: LancamentoData; fotoUrls: Array<{ url: string; r2Key: string }> } | null>(null)

  const { data: fornecedoresVariados } = useFornecedoresVariados(form.aba === 'Variados')

  useEffect(() => {
    let hasDraft = false
    try { hasDraft = !!localStorage.getItem(DRAFT_KEY) } catch { /* ignore */ }
    if (hasDraft) toast('Rascunho restaurado', 'info')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
      setLastSavedAt(new Date())
    }, 3000)
    return () => clearTimeout(id)
  }, [form])

  function set(key: keyof FormState, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleXmlParsed(data: { nf: string; data: string; fornecedor: string; valor: number; qtd: number; descricao: string }) {
    setForm(f => ({
      ...f, nf: data.nf, data: data.data,
      fornecedor: data.fornecedor, valor_unitario: String(data.valor),
      qtd: data.qtd > 0 ? String(data.qtd) : f.qtd,
      descricao: data.descricao || f.descricao,
    }))
  }

  function buildLancamentoData(): LancamentoData {
    return {
      nfd: form.nfd, nf: form.nf, data: form.data,
      fornecedor: form.fornecedor.toUpperCase(),
      aba: form.aba, tipo: form.tipo, motivo: form.motivo,
      descricao: form.descricao, qtd: parseInt(form.qtd) || 0,
      valor_unitario: parseFloat(form.valor_unitario) || 0,
      obs: form.obs,
    }
  }

  async function finalizarEnvio() {
    setForm(EMPTY_FORM)
    setFotos([])
    navigate('/app/notas')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!podeEscrever) return

    const data = buildLancamentoData()
    try {
      await insertNota.mutateAsync({ data, fotoUrls: fotos })
      await finalizarEnvio()
    } catch (err) {
      if (err instanceof DuplicateError) {
        pendingSubmit.current = { data, fotoUrls: fotos }
        setDuplicateInfo({ nf: err.nf, aba: err.aba })
      }
    }
  }

  async function handleConfirmDuplicate() {
    const pending = pendingSubmit.current
    setDuplicateInfo(null)
    if (!pending) return
    await insertNota.mutateAsync({ ...pending, force: true })
    pendingSubmit.current = null
    await finalizarEnvio()
  }

  const folder = form.aba && form.nfd ? `notas/${form.aba}/${form.nfd}` : `notas/temp/${Date.now()}`

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        {!podeEscrever && (
          <div className="rounded-btn border border-[var(--border)] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-2 text-sm font-medium">
            🔒 Modo somente-leitura
          </div>
        )}

        <fieldset disabled={!podeEscrever} className="space-y-4 disabled:opacity-60">
          <div className="flex items-center gap-3">
            <select
              value={form.aba}
              onChange={e => set('aba', e.target.value)}
              className="rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] px-3 py-2 text-sm"
            >
              {['Britania', 'Unilever', 'Variados'].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <XmlImporter onParsed={handleXmlParsed} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {([
              { key: 'nfd', label: 'NFD', required: true },
              { key: 'nf', label: 'NF', required: true },
              { key: 'data', label: 'Data', type: 'date', required: true },
              { key: 'fornecedor', label: 'Fornecedor', required: true },
              { key: 'tipo', label: 'Tipo' },
              { key: 'motivo', label: 'Motivo' },
              { key: 'qtd', label: 'Quantidade', type: 'number' },
              { key: 'valor_unitario', label: 'Valor Unitário', type: 'number' },
            ] as Array<{ key: keyof FormState; label: string; type?: string; required?: boolean }>).map(({ key, label, type = 'text', required }) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  type={type}
                  value={form[key]}
                  onChange={e => set(key, e.target.value)}
                  required={required}
                  onBlur={key === 'fornecedor' ? e => set('fornecedor', e.target.value.toUpperCase()) : undefined}
                  list={key === 'motivo' ? 'motivo-datalist' : key === 'fornecedor' && form.aba === 'Variados' ? 'fornecedor-datalist' : undefined}
                  autoComplete={key === 'motivo' || key === 'fornecedor' ? 'off' : undefined}
                />
              </div>
            ))}
          </div>

          <datalist id="motivo-datalist">
            {MOTIVOS_PADRAO.map(m => <option key={m} value={m} />)}
          </datalist>

          {form.aba === 'Variados' && (
            <datalist id="fornecedor-datalist">
              {(fornecedoresVariados ?? []).map(f => <option key={f} value={f} />)}
            </datalist>
          )}

          <div className="space-y-1">
            <Label>Descrição</Label>
            <textarea
              value={form.descricao}
              onChange={e => set('descricao', e.target.value)}
              rows={2}
              className="w-full rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm p-2 resize-none"
            />
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <textarea
              value={form.obs}
              onChange={e => set('obs', e.target.value)}
              rows={2}
              className="w-full rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm p-2 resize-none"
            />
          </div>

          <div className="space-y-1">
            <Label>Fotos de Avaria</Label>
            <FotoUpload folder={folder} onUploaded={setFotos} />
          </div>
        </fieldset>

        <div className="flex gap-3">
          <Button type="submit" className="bg-primary" disabled={insertNota.isPending || !podeEscrever}>
            {insertNota.isPending ? 'Salvando...' : 'Salvar NF'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/app/notas')}>
            Cancelar
          </Button>
        </div>

        {lastSavedAt && (
          <p className="text-xs text-[var(--text-muted)]">
            💾 Rascunho salvo às {lastSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </form>

      <Dialog open={!!duplicateInfo} onOpenChange={open => { if (!open) { setDuplicateInfo(null); pendingSubmit.current = null } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>NF duplicada</DialogTitle>
            <DialogDescription>
              {duplicateInfo && `NF ${duplicateInfo.nf} já existe para ${duplicateInfo.aba}. Deseja salvar mesmo assim?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setDuplicateInfo(null); pendingSubmit.current = null }}>
              Cancelar
            </Button>
            <Button type="button" className="bg-primary" onClick={handleConfirmDuplicate} disabled={insertNota.isPending}>
              Confirmar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
