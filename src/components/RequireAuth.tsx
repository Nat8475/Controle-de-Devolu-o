import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useRBAC } from '@/contexts/RBACContext'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const { loadingRBAC, modulos, isAdmin } = useRBAC()

  if (loading || loadingRBAC) {
    return (
      <div className="min-h-screen bg-app dark:bg-app-dark flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin && modulos.length === 0) return <Navigate to="/acesso-negado" replace />

  return <Outlet />
}
