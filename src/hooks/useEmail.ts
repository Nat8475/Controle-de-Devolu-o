import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toastStore'
import { useAuth } from '@/contexts/AuthContext'
import type { EmailLog, RespostaFornecedor } from '@/types/database'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`

export function useEmailLog() {
  return useQuery({
    queryKey: ['emails'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('emails_log')
        .select('*, profiles(nome)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as (EmailLog & { profiles: { nome: string } | null })[]
    },
  })
}

export function useSendEmail() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async (payload: {
      nota_ids: string[]
      destinatarios: string[]
      assunto: string
      corpo_html: string
    }) => {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      })
      const json = await res.json() as { ok?: boolean; status?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erro ao enviar')
      return json
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['emails'] })
      toast(data.status === 'erro' ? 'Salvo mas não enviado (verifique RESEND_API_KEY)' : 'E-mail enviado', data.status === 'erro' ? 'err' : 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })
}

export function useRespostasFornecedor(notaId: string | null) {
  return useQuery({
    queryKey: ['respostas', notaId],
    queryFn: async () => {
      if (!notaId) return []
      const { data, error } = await supabase
        .from('respostas_fornecedor')
        .select('*, profiles(nome)')
        .eq('nota_fiscal_id', notaId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as (RespostaFornecedor & { profiles: { nome: string } | null })[]
    },
    enabled: !!notaId,
  })
}

export function useAddResposta(notaId: string) {
  const qc = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (texto: string) => {
      if (!user) throw new Error('Não autenticado')
      const { error } = await supabase
        .from('respostas_fornecedor')
        .insert({ nota_fiscal_id: notaId, user_id: user.id, texto })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['respostas', notaId] })
      qc.invalidateQueries({ queryKey: ['nota', notaId] })
      toast('Resposta registrada', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })
}
