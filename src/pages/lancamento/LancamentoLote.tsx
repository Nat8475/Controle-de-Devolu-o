import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLancamento } from '@/hooks/useLancamento'
import type { SupabaseAba } from '@/types/database'

interface LoteRow {
  id: number
  nfd: string
  nf: string
  data: string
  fornecedor: string
  aba: SupabaseAba
  tipo: string
  motivo: string
  qtd: string
  valor_unitario: string
}

let nextId = 1
function emptyRow(): LoteRow {
  return { id: nextId++, nfd: '', nf: '', data: '', fornecedor: '', aba: 'Britania', tipo: '', motivo: '', qtd: '', valor_unitario: '' }
}

export function LancamentoLote() {
  const navigate = useNavigate()
  const { insertNota } = useLancamento()
  const [rows, setRows] = useState<LoteRow[]>([emptyRow()])
  const [sending, setSending] = useState(false)
  const [errors, setErrors] = useState<Record<number, string>>({})

  function update(id: number, key: keyof LoteRow, value: string) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [key]: value } : r))
  }

  function addRow() { setRows(rs => [...rs, emptyRow()]) }

  function removeRow(id: number) {
    setRows(rs => rs.length === 1 ? rs : rs.filter(r => r.id !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: Record<number, string> = {}
    rows.forEach(r => {
      if (!r.nfd || !r.nf || !r.data || !r.fornecedor) newErrors[r.id] = 'NFD, NF, Data e Fornecedor são obrigatórios'
    })
    if (Object.keys(newErrors).length) { setErrors(newErrors); return }
    setErrors({})
    setSending(true)
    try {
      for (const row of rows) {
        await insertNota.mutateAsync({
          data: {
            nfd: row.nfd, nf: row.nf, data: row.data,
            fornecedor: row.fornecedor.toUpperCase(),
            aba: row.aba, tipo: row.tipo, motivo: row.motivo,
            descricao: '', qtd: parseInt(row.qtd) || 0,
            valor_unitario: parseFloat(row.valor_unitario) || 0, obs: '',
          },
          fotoUrls: [],
        })
      }
      navigate('/app/notas')
    } finally {
      setSending(false)
    }
  }

  const colClass = 'text-xs rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-primary/40'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {['NFD*', 'NF*', 'Data*', 'Fornecedor*', 'Aba', 'Tipo', 'Motivo', 'Qtd', 'Valor Unit.', ''].map(h => (
                <th key={h} className="text-left px-1 pb-2 text-xs text-[var(--text-muted)] font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="space-y-1">
            {rows.map(row => (
              <tr key={row.id} className={errors[row.id] ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                <td className="px-1 py-1"><input className={colClass} value={row.nfd} onChange={e => update(row.id, 'nfd', e.target.value)} /></td>
                <td className="px-1 py-1"><input className={colClass} value={row.nf} onChange={e => update(row.id, 'nf', e.target.value)} /></td>
                <td className="px-1 py-1"><input type="date" className={colClass} value={row.data} onChange={e => update(row.id, 'data', e.target.value)} /></td>
                <td className="px-1 py-1"><input className={colClass} value={row.fornecedor} onChange={e => update(row.id, 'fornecedor', e.target.value)} /></td>
                <td className="px-1 py-1">
                  <select value={row.aba} onChange={e => update(row.id, 'aba', e.target.value)} className={colClass}>
                    {['Britania', 'Unilever', 'Variados'].map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </td>
                <td className="px-1 py-1"><input className={colClass} value={row.tipo} onChange={e => update(row.id, 'tipo', e.target.value)} /></td>
                <td className="px-1 py-1"><input className={colClass} value={row.motivo} onChange={e => update(row.id, 'motivo', e.target.value)} /></td>
                <td className="px-1 py-1"><input type="number" className={colClass} style={{ width: 64 }} value={row.qtd} onChange={e => update(row.id, 'qtd', e.target.value)} /></td>
                <td className="px-1 py-1"><input type="number" step="0.01" className={colClass} style={{ width: 90 }} value={row.valor_unitario} onChange={e => update(row.id, 'valor_unitario', e.target.value)} /></td>
                <td className="px-1 py-1">
                  <button type="button" onClick={() => removeRow(row.id)} className="text-[var(--text-muted)] hover:text-red-500 transition-colors p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {Object.keys(errors).length > 0 && (
        <p className="text-xs text-red-600">Preencha os campos obrigatórios (*) em todas as linhas com erro.</p>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />Adicionar linha
        </Button>
        <Button type="submit" className="bg-primary gap-1.5" disabled={sending}>
          <Send className="w-3.5 h-3.5" />
          {sending ? `Salvando ${rows.length} NFs...` : `Salvar ${rows.length} NF${rows.length > 1 ? 's' : ''}`}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate('/app/notas')}>Cancelar</Button>
      </div>
    </form>
  )
}
