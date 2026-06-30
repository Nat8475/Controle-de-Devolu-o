import { Navigate } from 'react-router-dom'
import { usePermission } from '@/hooks/usePermission'
import type { Modulo } from '@/types/database'

interface Props {
  mod: Modulo
  children: React.ReactNode
}

export function RequireModule({ mod, children }: Props) {
  const { hasModule } = usePermission()
  if (!hasModule(mod)) return <Navigate to="/acesso-negado" replace />
  return <>{children}</>
}
