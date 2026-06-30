import { useRBAC } from '@/contexts/RBACContext'
import type { Modulo } from '@/types/database'

export function usePermission() {
  const { modulos, isAdmin } = useRBAC()

  function hasModule(mod: Modulo): boolean {
    if (isAdmin) return true
    return modulos.includes(mod)
  }

  return { hasModule, isAdmin }
}
