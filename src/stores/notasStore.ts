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

export interface NotasFilterPreset {
  id: string
  nome: string
  filters: NotasFilters
}

const STORAGE_KEYS = {
  filters: 'cdv_filtros_salvos',
  density: 'cdv_density',
  columns: 'cdv_colunas',
  kpiVis: 'cdv_kpi_visibilidade',
  presets: 'cdv_filtros_presets',
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
  savedPresets: NotasFilterPreset[]
  setFilter: (key: keyof NotasFilters, value: string | boolean) => void
  resetFilters: () => void
  toggleFiltersVisible: () => void
  toggleSelect: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
  setDensity: (d: Density) => void
  setColumnVisibility: (col: string, visible: boolean) => void
  toggleKpi: (key: string) => void
  savePreset: (nome: string) => void
  applyPreset: (id: string) => void
  deletePreset: (id: string) => void
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
  savedPresets: loadFromStorage<NotasFilterPreset[]>(STORAGE_KEYS.presets, []),
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
  savePreset: (nome) => {
    const preset: NotasFilterPreset = {
      id: crypto.randomUUID(),
      nome,
      filters: get().filters,
    }
    const presets = [...get().savedPresets, preset]
    set({ savedPresets: presets })
    localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(presets))
  },
  applyPreset: (id) => {
    const preset = get().savedPresets.find(p => p.id === id)
    if (!preset) return
    set({ filters: preset.filters, selectedIds: new Set() })
    localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(preset.filters))
  },
  deletePreset: (id) => {
    const presets = get().savedPresets.filter(p => p.id !== id)
    set({ savedPresets: presets })
    localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(presets))
  },
}))
