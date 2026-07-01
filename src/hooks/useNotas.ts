import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toastStore'
import type { NotaFiscal, SupabaseStatus } from '@/types/database'
import type { NotasFilters } from '@/stores/notasStore'

/**
 * Remove acentos/diacríticos de um termo de busca, para tolerar variações
 * de acentuação (ex: "devolucao" deve encontrar "devolução").
 * Mesma estratégia usada no legado (_normFonetico em FormNotas.html).
 */
function normalizeFonetico(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function useNotas(filters: NotasFilters) {
  return useQuery({
    queryKey: ['notas', filters],
    queryFn: async () => {
      let q = supabase
        .from('notas_fiscais')
        .select('*')
        .is('deleted_at', null)
        .order('data', { ascending: false })

      if (filters.status) q = q.eq('status', filters.status)
      if (filters.aba) q = q.eq('aba', filters.aba)
      if (filters.dataIni) q = q.gte('data', filters.dataIni)
      if (filters.dataFim) q = q.lte('data', filters.dataFim)
      if (filters.semFrete) q = q.is('frete_tipo', null)
      if (filters.busca) {
        const term = filters.busca.trim()
        const normalized = normalizeFonetico(term)
        const fields = ['nfd', 'nf', 'fornecedor', 'descricao']
        const variants = normalized && normalized !== term ? [term, normalized] : [term]
        const orParts = fields.flatMap(field => variants.map(v => `${field}.ilike.%${v}%`))
        q = q.or(orParts.join(','))
      }

      const { data, error } = await q
      if (error) throw error
      return data as NotaFiscal[]
    },
  })
}

export function useNotaDetail(id: string | null) {
  return useQuery({
    queryKey: ['nota', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('notas_fiscais')
        .select(`*, fotos_nf(*), comentarios(*, profiles(nome)), respostas_fornecedor(*, profiles(nome))`)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useNotasMutation() {
  const qc = useQueryClient()

  const updateStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: SupabaseStatus }) => {
      const { error } = await supabase
        .from('notas_fiscais')
        .update({ status })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas'] })
      toast('Status atualizado', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })

  const softDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('notas_fiscais')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas'] })
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })

  const updateNota = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<NotaFiscal> }) => {
      const { error } = await supabase
        .from('notas_fiscais')
        .update(data)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_result, vars) => {
      qc.invalidateQueries({ queryKey: ['notas'] })
      qc.invalidateQueries({ queryKey: ['nota', vars.id] })
      toast('Nota atualizada', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })

  return { updateStatus, softDelete, updateNota }
}
