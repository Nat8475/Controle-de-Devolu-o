import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toastStore'
import { useAuth } from '@/contexts/AuthContext'
import type { Transferencia } from '@/types/database'

export function useTransferencias() {
  return useQuery({
    queryKey: ['transferencias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transferencias')
        .select('*, notas_fiscais(nfd, nf, fornecedor, aba)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useNotaTransferencias(notaId: string | null) {
  return useQuery({
    queryKey: ['transferencias', notaId],
    queryFn: async () => {
      if (!notaId) return []
      const { data, error } = await supabase
        .from('transferencias')
        .select('*')
        .eq('nota_fiscal_id', notaId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Transferencia[]
    },
    enabled: !!notaId,
  })
}

export function useTransferenciasMutation() {
  const qc = useQueryClient()

  const insertTransferencia = useMutation({
    mutationFn: async (payload: {
      nota_fiscal_id: string
      nfd: string
      nf: string
      tipo?: string
      caixas?: number
      valor?: number
      num_pedido?: string
      agendamento?: string
    }) => {
      const { error: tfError } = await supabase.from('transferencias').insert(payload)
      if (tfError) throw tfError
      const { error: nfError } = await supabase
        .from('notas_fiscais')
        .update({ status: 'Em Transferência' })
        .eq('id', payload.nota_fiscal_id)
      if (nfError) throw nfError
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias'] })
      qc.invalidateQueries({ queryKey: ['notas'] })
      toast('Transferência registrada', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })

  const updateTransferencia = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Transferencia['status'] }) => {
      const { error } = await supabase.from('transferencias').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias'] })
      toast('Transferência atualizada', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })

  return { insertTransferencia, updateTransferencia }
}

export function useComentariosMutation(notaId: string) {
  const qc = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (texto: string) => {
      if (!user) throw new Error('Não autenticado')
      const { error } = await supabase
        .from('comentarios')
        .insert({ nota_fiscal_id: notaId, user_id: user.id, texto })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nota', notaId] })
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })
}
