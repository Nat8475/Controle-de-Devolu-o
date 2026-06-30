import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { XmlImporter } from './XmlImporter'
import { FotoUpload } from './FotoUpload'
import { useLancamento } from '@/hooks/useLancamento'
import type { SupabaseAba } from '@/types/database'

const DRAFT_KEY = 'cdv_draft_lancamento'

const EMPTY_FORM = {
  nfd: '', nf: '', data: '', fornecedor: '', aba: 'Britania' as SupabaseAba,
  tipo: '', motivo: '', descricao: '', qtd: '', valor_unitario: '', obs: '',
}

type FormState = typeof EMPTY_FORM

export function LancamentoForm() {
  const navigate = useNavigate()
  const { insertNota } = useLancamento()
  const [form, setForm] = useState<FormState>(() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '') as FormState } catch { return EMPTY_FORM }
  })
  const [fotos, setFotos] = useState<Array<{ url: string; r2Key: string }>>([])

  useEffect(() => {
    const id = setTimeout(() => localStorage.setItem(DRAFT_KEY, JSON.stringify(form)), 3000)
    return () => clearTimeout(id)
  }, [form])

  function set(key: keyof FormState, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleXmlParsed(data: { nf: string; data: string; fornecedor: string; valor: number }) {
    setForm(f => ({
      ...f, nf: data.nf, data: data.data,
      fornecedor: data.fornecedor, valor_unitario: String(data.valor),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await insertNota.mutateAsync({
      data: {
        nfd: form.nfd, nf: form.nf, data: form.data,
        fornecedor: form.fornecedor.toUpperCase(),
        aba: form.aba, tipo: form.tipo, motivo: form.motivo,
        descricao: form.descricao, qtd: parseInt(form.qtd) || 0,
        valor_unitario: parseFloat(form.valor_unitario) || 0,
        obs: form.obs,
      },
      fotoUrls: fotos,
    })
    setForm(EMPTY_FORM)
    setFotos([])
    navigate('/app/notas')
  }

  const folder = form.aba && form.nfd ? `notas/${form.aba}/${form.nfd}` : `notas/temp/${Date.now()}`

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
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
            />
          </div>
        ))}
      </div>

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

      <div className="flex gap-3">
        <Button type="submit" className="bg-primary" disabled={insertNota.isPending}>
          {insertNota.isPending ? 'Salvando...' : 'Salvar NF'}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate('/app/notas')}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
