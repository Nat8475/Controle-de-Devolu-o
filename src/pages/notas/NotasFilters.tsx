import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Filter, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useNotasStore, type NotasFilters } from '@/stores/notasStore'

interface Props {
  filters: NotasFilters
  onFilter: (key: keyof NotasFilters, value: string | boolean) => void
  onReset: () => void
  visible: boolean
  onToggle: () => void
}

export function NotasFilters({ filters, onFilter, onReset, visible, onToggle }: Props) {
  const savedPresets = useNotasStore(s => s.savedPresets)
  const savePreset = useNotasStore(s => s.savePreset)
  const applyPreset = useNotasStore(s => s.applyPreset)
  const deletePreset = useNotasStore(s => s.deletePreset)

  const [showSaveInput, setShowSaveInput] = useState(false)
  const [presetNome, setPresetNome] = useState('')

  const activeCount = [
    filters.status, filters.aba, filters.dataIni, filters.dataFim,
    filters.semFrete ? '1' : '', filters.busca,
  ].filter(Boolean).length

  function handleSavePreset() {
    const nome = presetNome.trim()
    if (!nome) return
    savePreset(nome)
    setPresetNome('')
    setShowSaveInput(false)
  }

  return (
    <div className="border-b border-[var(--border)]">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] transition-colors"
      >
        <Filter className="w-4 h-4" />
        <span>Filtros</span>
        {activeCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-primary text-white rounded-badge text-xs">{activeCount}</span>
        )}
      </button>

      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pt-3 flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-3">
              <select
                value=""
                onChange={e => { if (e.target.value) applyPreset(e.target.value) }}
                className="rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-2 py-1.5"
              >
                <option value="">Filtros salvos...</option>
                {savedPresets.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>

              {savedPresets.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {savedPresets.map(p => (
                    <span
                      key={p.id}
                      className="flex items-center gap-1 pl-2 pr-1 py-1 bg-[var(--border)] rounded-badge text-xs text-[var(--text)]"
                    >
                      <button
                        onClick={() => applyPreset(p.id)}
                        className="hover:text-primary transition-colors"
                        title={`Aplicar "${p.nome}"`}
                      >
                        {p.nome}
                      </button>
                      <button
                        onClick={() => deletePreset(p.id)}
                        className="text-[var(--text-muted)] hover:text-danger transition-colors"
                        title="Remover filtro salvo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="ml-auto flex items-center gap-2">
                {showSaveInput ? (
                  <>
                    <Input
                      autoFocus
                      value={presetNome}
                      onChange={e => setPresetNome(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSavePreset()
                        if (e.key === 'Escape') { setShowSaveInput(false); setPresetNome('') }
                      }}
                      placeholder="Nome do filtro..."
                      className="text-sm h-8 w-40"
                    />
                    <button
                      onClick={handleSavePreset}
                      className="px-2 py-1 text-xs rounded-btn bg-primary text-white hover:opacity-90 transition-opacity"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => { setShowSaveInput(false); setPresetNome('') }}
                      className="text-[var(--text-muted)] hover:text-danger transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowSaveInput(true)}
                    className="px-2 py-1 text-xs rounded-btn border border-[var(--border)] text-[var(--text)] hover:bg-[var(--border)] transition-colors whitespace-nowrap"
                  >
                    💾 Salvar filtro atual
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <select
                value={filters.status}
                onChange={e => onFilter('status', e.target.value)}
                className="rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-2 py-1.5"
              >
                <option value="">Todos os status</option>
                {['Pendente', 'Em Transferência', 'Devolvido', 'Cancelado', 'Vendido'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={filters.aba}
                onChange={e => onFilter('aba', e.target.value)}
                className="rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-2 py-1.5"
              >
                <option value="">Todos fornecedores</option>
                {['Britania', 'Unilever', 'Variados'].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>

              <Input
                type="date"
                value={filters.dataIni}
                onChange={e => onFilter('dataIni', e.target.value)}
                className="text-sm"
              />

              <Input
                type="date"
                value={filters.dataFim}
                onChange={e => onFilter('dataFim', e.target.value)}
                className="text-sm"
              />

              <label className="flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.semFrete}
                  onChange={e => onFilter('semFrete', e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                Sem frete
              </label>

              <div className="flex gap-2">
                <Input
                  id="busca-input"
                  value={filters.busca}
                  onChange={e => onFilter('busca', e.target.value)}
                  placeholder="Busca..."
                  className="text-sm flex-1"
                />
                {activeCount > 0 && (
                  <button onClick={onReset} className="text-[var(--text-muted)] hover:text-danger transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
