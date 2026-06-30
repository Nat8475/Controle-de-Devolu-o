import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toastStore'
import { useAuth } from '@/contexts/AuthContext'
import type { AuditLog, Config, Backup, Profile, Cargo, Modulo } from '@/types/database'

const FUNCTION_URL = (fn: string) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`

// ─── Audit Log ────────────────────────────────────────────────────────────────

export function useAuditLog(limit = 100) {
  return useQuery({
    queryKey: ['audit', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*, profiles(nome, email)')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as (AuditLog & { profiles: { nome: string; email: string } | null })[]
    },
  })
}

// ─── Backups ──────────────────────────────────────────────────────────────────

export function useBackups() {
  return useQuery({
    queryKey: ['backups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backups')
        .select('*, profiles(nome)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as (Backup & { profiles: { nome: string } | null })[]
    },
  })
}

export function useCreateBackup() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(FUNCTION_URL('create-backup'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      })
      const json = await res.json() as { ok?: boolean; nome?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar backup')
      return json
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['backups'] })
      toast(`Backup criado: ${data.nome}`, 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })
}

// ─── Configs ──────────────────────────────────────────────────────────────────

export function useConfigs() {
  return useQuery({
    queryKey: ['configs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('configs').select('*')
      if (error) throw error
      return data as Config[]
    },
  })
}

export function useUpdateConfig() {
  const qc = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: unknown }) => {
      const { error } = await supabase
        .from('configs')
        .upsert({ chave, valor, updated_at: new Date().toISOString(), updated_by: user?.id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['configs'] })
      toast('Configuração salva', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })
}

// ─── Users & Cargos ───────────────────────────────────────────────────────────

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, usuario_cargos(cargo_id, cargos(nome))')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as (Profile & { usuario_cargos: Array<{ cargo_id: string; cargos: { nome: string } | null }> })[]
    },
  })
}

export function useCargos() {
  return useQuery({
    queryKey: ['cargos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cargos')
        .select('*, cargo_modulos(modulo)')
        .order('nome')
      if (error) throw error
      return data as (Cargo & { cargo_modulos: Array<{ modulo: Modulo }> })[]
    },
  })
}

export function useAssignCargo() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, cargoId }: { userId: string; cargoId: string | null }) => {
      await supabase.from('usuario_cargos').delete().eq('user_id', userId)
      if (cargoId) {
        const { error } = await supabase.from('usuario_cargos').insert({ user_id: userId, cargo_id: cargoId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      toast('Cargo atualizado', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })
}

export function useCreateCargo() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ nome, modulos }: { nome: string; modulos: Modulo[] }) => {
      const { data, error } = await supabase.from('cargos').insert({ nome }).select().single()
      if (error) throw error
      if (modulos.length > 0) {
        const { error: modErr } = await supabase.from('cargo_modulos').insert(
          modulos.map(m => ({ cargo_id: data.id, modulo: m }))
        )
        if (modErr) throw modErr
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cargos'] })
      toast('Cargo criado', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })
}

export function useDeleteCargo() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cargos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cargos'] })
      toast('Cargo removido', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })
}
