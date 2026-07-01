import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Send, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useLancamento } from '@/hooks/useLancamento'
import { FotoUpload } from './FotoUpload'
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
  descricao: string
  qtd: string
  valor_unitario: string
  fotos: Array<{ url: string; r2Key: string }>
}

const MOTIVOS_PADRAO = [
  'MEDIDAS FORA DA TOLERÂNCIA', 'EMBALAGEM AVARIADA', 'PRODUTO ERRADO',
  'QUANTIDADE INCORRETA', 'VALIDADE VENCIDA', 'PRODUTO SEM REGISTRO',
  'NF COM ERRO', 'FALTA DE DOCUMENTAÇÃO', 'DIVERGÊNCIA DE PREÇO',
  'PRODUTO IMPRÓPRIO PARA CONSUMO', 'SOBRA DE ESTOQUE', 'DEVOLUÇÃO COMERCIAL',
]

let nextId = 1
function emptyRow(): LoteRow {
  return { id: nextId++, nfd: '', nf: '', data: '', fornecedor: '', aba: 'Britania', tipo: '', motivo: '', descricao: '', qtd: '', valor_unitario: '', fotos: [] }
}

export function LancamentoLote() {
  const navigate = useNavigate()
  const { insertNota } = useLancamento()
  const [rows, setRows] = useState<LoteRow[]>([emptyRow()])
  const [sending, setSending] = useState(false)
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [fotoModalId, setFotoModalId] = useState<number | null>(null)

  function update(id: number, key: keyof LoteRow, value: string) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [key]: value } : r))
  }

  // Fotos já confirmadas em sessões anteriores do modal (persistem mesmo após fechar/reabrir,
  // já que o <FotoUpload> dentro do Dialog é desmontado ao fechar e perde seu estado interno).
  const [savedFotos, setSavedFotos] = useState<Record<number, Array<{ url: string; r2Key: string }>>>({})

  function updateFotos(id: number, sessionPhotos: Array<{ url: string; r2Key: string }>) {
    const prevSaved = savedFotos[id] ?? []
    setRows(rs => rs.map(r => r.id === id ? { ...r, fotos: [...prevSaved, ...sessionPhotos] } : r))
  }

  function closeFotoModal() {
    if (fotoModalId !== null) {
      const row = rows.find(r => r.id === fotoModalId)
      setSavedFotos(prev => ({ ...prev, [fotoModalId]: row?.fotos ?? [] }))
    }
    setFotoModalId(null)
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
            descricao: row.descricao, qtd: parseInt(row.qtd) || 0,
            valor_unitario: parseFloat(row.valor_unitario) || 0, obs: '',
          },
          fotoUrls: row.fotos,
        })
      }
      navigate('/app/notas')
    } finally {
      setSending(false)
    }
  }

  const colClass = 'text-xs rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-primary/40'
  const fotoRow = rows.find(r => r.id === fotoModalId) ?? null

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {['NFD*', 'NF*', 'Data*', 'Fornecedor*', 'Aba', 'Tipo', 'Motivo', 'Descrição', 'Qtd', 'Valor Unit.', 'Fotos', ''].map(h => (
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
                <td className="px-1 py-1">
                  <input className={colClass} list="lote-motivo-datalist" value={row.motivo} onChange={e => update(row.id, 'motivo', e.target.value)} />
                </td>
                <td className="px-1 py-1"><input className={colClass} style={{ width: 120 }} value={row.descricao} onChange={e => update(row.id, 'descricao', e.target.value)} /></td>
                <td className="px-1 py-1"><input type="number" className={colClass} style={{ width: 64 }} value={row.qtd} onChange={e => update(row.id, 'qtd', e.target.value)} /></td>
                <td className="px-1 py-1"><input type="number" step="0.01" className={colClass} style={{ width: 90 }} value={row.valor_unitario} onChange={e => update(row.id, 'valor_unitario', e.target.value)} /></td>
                <td className="px-1 py-1">
                  <button
                    type="button"
                    onClick={() => setFotoModalId(row.id)}
                    className={`relative p-1.5 rounded-btn border transition-colors ${row.fotos.length > 0 ? 'border-primary/50 text-primary bg-primary/5' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-primary hover:border-primary/50'}`}
                    title="Anexar fotos de avaria"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {row.fotos.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] leading-none rounded-full w-3.5 h-3.5 flex items-center justify-center">
                        {row.fotos.length}
                      </span>
                    )}
                  </button>
                </td>
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

      <datalist id="lote-motivo-datalist">
        {MOTIVOS_PADRAO.map(m => <option key={m} value={m} />)}
      </datalist>

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

      <Dialog open={fotoModalId !== null} onOpenChange={open => !open && closeFotoModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fotos de avaria {fotoRow ? `— NFD ${fotoRow.nfd || '(sem NFD)'}` : ''}</DialogTitle>
          </DialogHeader>
          {fotoRow && (
            <div className="space-y-3">
              {(savedFotos[fotoRow.id]?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-1.5">Já anexadas nesta linha:</p>
                  <div className="grid grid-cols-4 gap-2">
                    {savedFotos[fotoRow.id]!.map(p => (
                      <img key={p.r2Key} src={p.url} className="w-full h-16 object-cover rounded-btn" />
                    ))}
                  </div>
                </div>
              )}
              <FotoUpload
                folder={`notas/${fotoRow.aba}/${fotoRow.nfd || 'temp-' + fotoRow.id}`}
                onUploaded={photos => updateFotos(fotoRow.id, photos)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </form>
  )
}
