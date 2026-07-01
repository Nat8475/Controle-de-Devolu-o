import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toastStore'
import { useAuth } from '@/contexts/AuthContext'
import type { SupabaseAba, FreteTipo } from '@/types/database'

export interface LancamentoData {
  nfd: string
  nf: string
  data: string
  fornecedor: string
  aba: SupabaseAba
  tipo: string
  motivo: string
  descricao: string
  qtd: number
  valor_unitario: number
  frete_tipo?: FreteTipo | null
  frete_valor?: number | null
  obs?: string
}

export class DuplicateError extends Error {
  nf: string
  aba: SupabaseAba

  constructor(nf: string, aba: SupabaseAba) {
    super(`NF ${nf} já existe para ${aba}. Deseja salvar mesmo assim?`)
    this.name = 'DuplicateError'
    this.nf = nf
    this.aba = aba
  }
}

export function useLancamento() {
  const qc = useQueryClient()
  const { user } = useAuth()

  const insertNota = useMutation({
    mutationFn: async ({
      data,
      fotoUrls,
      force = false,
    }: {
      data: LancamentoData
      fotoUrls: Array<{ url: string; r2Key: string }>
      force?: boolean
    }) => {
      if (!force) {
        const { data: existing } = await supabase
          .from('notas_fiscais')
          .select('id')
          .eq('nf', data.nf)
          .eq('aba', data.aba)
          .is('deleted_at', null)
          .single()

        if (existing) {
          throw new DuplicateError(data.nf, data.aba)
        }
      }

      const { data: inserted, error } = await supabase
        .from('notas_fiscais')
        .insert({ ...data, responsavel_id: user?.id })
        .select()
        .single()
      if (error) throw error

      if (fotoUrls.length > 0) {
        await supabase.from('fotos_nf').insert(
          fotoUrls.map((f, i) => ({
            nota_fiscal_id: inserted.id,
            url: f.url,
            r2_key: f.r2Key,
            nome: `foto-${i + 1}`,
            ordem: i,
          }))
        )
      }

      return inserted
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas'] })
      toast('NF lançada com sucesso', 'ok')
      localStorage.removeItem('cdv_draft_lancamento')
    },
    onError: (e: Error) => {
      if (e instanceof DuplicateError) return
      toast(e.message, 'err')
    },
  })

  return { insertNota }
}

/** Fornecedores distintos já lançados na aba "Variados", para sugestão via datalist. */
export function useFornecedoresVariados(enabled: boolean) {
  return useQuery({
    queryKey: ['fornecedores-variados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_fiscais')
        .select('fornecedor')
        .eq('aba', 'Variados')
      if (error) throw error

      const unicos = new Set<string>()
      for (const row of data ?? []) {
        if (row.fornecedor) unicos.add(row.fornecedor)
      }
      return Array.from(unicos).sort()
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}
