import { useMutation, useQueryClient } from '@tanstack/react-query'
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

export function useLancamento() {
  const qc = useQueryClient()
  const { user } = useAuth()

  const insertNota = useMutation({
    mutationFn: async ({ data, fotoUrls }: { data: LancamentoData; fotoUrls: Array<{ url: string; r2Key: string }> }) => {
      const { data: existing } = await supabase
        .from('notas_fiscais')
        .select('id')
        .eq('nf', data.nf)
        .eq('aba', data.aba)
        .is('deleted_at', null)
        .single()

      if (existing) {
        const confirmed = window.confirm(`NF ${data.nf} já existe para ${data.aba}. Deseja salvar mesmo assim?`)
        if (!confirmed) throw new Error('CANCELLED')
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
      if (e.message !== 'CANCELLED') toast(e.message, 'err')
    },
  })

  return { insertNota }
}
