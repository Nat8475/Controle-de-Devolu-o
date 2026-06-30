import { create } from 'zustand'
import type { SupabaseStatus, SupabaseAba } from '@/types/database'

export interface NotasFilters {
  status: SupabaseStatus | ''
  aba: SupabaseAba | ''
  dataIni: string
  dataFim: string
  semFrete: boolean
  busca: string
}

export type Density = 'compact' | 'normal' | 'comfortable'

const DEFAULT_FILTERS: NotasFilters = {
  status: '',
  aba: '',
  dataIni: '',
  dataFim: '',
  semFrete: false,
  busca: '',
}

const STORAGE_KEYS = {
  filters: 'cdv_filtros_salvos',
  density: 'cdv_density',
  columns: 'cdv_colunas',
  kpiVis: 'cdv_kpi_visibilidade',
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? '') ?? fallback }
  catch { return fallback }
}

interface NotasState {
  filters: NotasFilters
  filtersVisible: boolean
  selectedIds: Set<string>
  density: Density
  columnVisibility: Record<string, boolean>
  kpiVisibility: Record<string, boolean>
  setFilter: (key: keyof NotasFilters, value: string | boolean) => void
  resetFilters: () => void
  toggleFiltersVisible: () => void
  toggleSelect: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
  setDensity: (d: Density) => void
  setColumnVisibility: (col: string, visible: boolean) => void
  toggleKpi: (key: string) => void
}

export const useNotasStore = create<NotasState>((set, get) => ({
  filters: loadFromStorage(STORAGE_KEYS.filters, DEFAULT_FILTERS),
  filtersVisible: localStorage.getItem('cdv_filtros_vis') !== '0',
  selectedIds: new Set(),
  density: loadFromStorage<Density>(STORAGE_KEYS.density, 'normal'),
  columnVisibility: loadFromStorage(STORAGE_KEYS.columns, {
    nfd: true, nf: true, data: true, fornecedor: true, tipo: true,
    motivo: true, qtd: true, valor_total: true, status: true, dias_armazem: false,
    frete_tipo: false, frete_valor: false, obs: false,
  }),
  kpiVisibility: loadFromStorage(STORAGE_KEYS.kpiVis, {
    pendente: true, em_transferencia: true, devolvido: true,
    venda: true, total: true, caixas: true,
  }),
  setFilter: (key, value) => {
    const filters = { ...get().filters, [key]: value }
    set({ filters, selectedIds: new Set() })
    localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(filters))
  },
  resetFilters: () => set({ filters: DEFAULT_FILTERS, selectedIds: new Set() }),
  toggleFiltersVisible: () => {
    const next = !get().filtersVisible
    set({ filtersVisible: next })
    localStorage.setItem('cdv_filtros_vis', next ? '1' : '0')
  },
  toggleSelect: (id) => {
    const s = new Set(get().selectedIds)
    s.has(id) ? s.delete(id) : s.add(id)
    set({ selectedIds: s })
  },
  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  clearSelection: () => set({ selectedIds: new Set() }),
  setDensity: (d) => {
    set({ density: d })
    localStorage.setItem(STORAGE_KEYS.density, JSON.stringify(d))
  },
  setColumnVisibility: (col, visible) => {
    const cv = { ...get().columnVisibility, [col]: visible }
    set({ columnVisibility: cv })
    localStorage.setItem(STORAGE_KEYS.columns, JSON.stringify(cv))
  },
  toggleKpi: (key) => {
    const kv = { ...get().kpiVisibility, [key]: !get().kpiVisibility[key] }
    set({ kpiVisibility: kv })
    localStorage.setItem(STORAGE_KEYS.kpiVis, JSON.stringify(kv))
  },
}))
