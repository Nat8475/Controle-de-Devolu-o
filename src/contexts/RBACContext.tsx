import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Modulo } from '@/types/database'

interface RBACContextValue {
  cargo: string | null
  modulos: Modulo[]
  isAdmin: boolean
  loadingRBAC: boolean
}

const RBACContext = createContext<RBACContextValue | null>(null)

export function RBACProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [cargo, setCargo] = useState<string | null>(null)
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loadingRBAC, setLoadingRBAC] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoadingRBAC(false); return }
    loadPermissions(user.id)
  }, [user, authLoading])

  async function loadPermissions(userId: string) {
    setLoadingRBAC(true)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()

    if (profileData?.is_admin) {
      setIsAdmin(true)
      setModulos(['notas', 'lancamento', 'email', 'transferencias', 'relatorios', 'auditoria', 'backup', 'configuracoes', 'dashboard'])
      setLoadingRBAC(false)
      return
    }

    const { data } = await supabase
      .from('usuario_cargos')
      .select('cargo:cargos(nome), cargo_modulos(modulo)')
      .eq('user_id', userId)
      .single()

    if (data) {
      const c = data.cargo as unknown as { nome: string } | null
      const mods = (data.cargo_modulos as unknown as { modulo: string }[]).map(m => m.modulo as Modulo)
      setCargo(c?.nome ?? null)
      setModulos(mods)
    }

    setLoadingRBAC(false)
  }

  return (
    <RBACContext.Provider value={{ cargo, modulos, isAdmin, loadingRBAC }}>
      {children}
    </RBACContext.Provider>
  )
}

export function useRBAC() {
  const ctx = useContext(RBACContext)
  if (!ctx) throw new Error('useRBAC must be used inside RBACProvider')
  return ctx
}
