import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { useNotas, useNotasMutation } from '@/hooks/useNotas'
import { useNotasStore } from '@/stores/notasStore'
import { NotasKPIs } from './NotasKPIs'
import { NotasFilters } from './NotasFilters'
import { NotasTable } from './NotasTable'
import { NotasBulkBar } from './NotasBulkBar'
import { NotaDetail } from './NotaDetail'
import { showUndo } from '@/stores/undoStore'
import { Button } from '@/components/ui/button'
import type { NotaFiscal } from '@/types/database'

export default function NotasPage() {
  const navigate = useNavigate()
  const store = useNotasStore()
  const { data = [], isLoading, refetch } = useNotas(store.filters)
  const { updateStatus, softDelete } = useNotasMutation()
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'F5' || e.key === 'r') { e.preventDefault(); refetch() }
      if (e.key === 'Escape') { store.clearSelection(); setDetailId(null) }
      if (e.key === 'a') store.selectAll(data.map(n => n.id))
      if (e.key === 'f') document.getElementById('busca-input')?.focus()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [data, refetch, store])

  function handleBulkAction(type: string, notas: NotaFiscal[]) {
    const ids = notas.map(n => n.id)

    if (type === 'devolver') {
      const prev = notas.map(n => ({ id: n.id, status: n.status }))
      updateStatus.mutate({ ids, status: 'Devolvido' })
      showUndo('Marcadas como Devolvido', async () => {
        for (const p of prev) {
          await updateStatus.mutateAsync({ ids: [p.id], status: p.status })
        }
      })
      store.clearSelection()
      return
    }

    if (type === 'venda') { navigate('/app/venda', { state: { nfds: notas.map(n => n.nfd) } }); return }
    if (type === 'frete') { navigate('/app/frete', { state: { nota: notas[0] } }); return }
    if (type === 'email') {
      localStorage.setItem('cdv_email_nfds', JSON.stringify(notas.map(n => n.nfd)))
      navigate('/app/email')
    }
    if (type === 'docCarga') {
      localStorage.setItem('cdv_pdf_prefill', JSON.stringify(notas.map(n => n.nfd)))
      navigate('/app/exportar-pdf')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-surface dark:bg-surface-dark">
        <h2 className="font-heading font-semibold text-[var(--text)]">Notas Fiscais</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{data.length} notas</span>
          <Button variant="ghost" size="icon" onClick={() => refetch()} title="Recarregar (F5)">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <NotasKPIs data={data} visibility={store.kpiVisibility} onToggle={store.toggleKpi} />

      <NotasFilters
        filters={store.filters}
        onFilter={store.setFilter}
        onReset={store.resetFilters}
        visible={store.filtersVisible}
        onToggle={store.toggleFiltersVisible}
      />

      <div className="flex-1 overflow-auto">
        <NotasTable
          data={data}
          selectedIds={store.selectedIds}
          density={store.density}
          columnVisibility={store.columnVisibility}
          onSelect={store.toggleSelect}
          onSelectAll={() =>
            store.selectedIds.size === data.length
              ? store.clearSelection()
              : store.selectAll(data.map(n => n.id))
          }
          onRowClick={nota => setDetailId(nota.id)}
          isLoading={isLoading}
        />
      </div>

      <NotasBulkBar
        selectedIds={store.selectedIds}
        data={data}
        onAction={handleBulkAction}
        onClear={store.clearSelection}
      />

      <NotaDetail id={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
