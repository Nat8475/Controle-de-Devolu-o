import { useNavigate } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

export default function AccessDeniedPage() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-app dark:bg-app-dark flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <ShieldX className="w-16 h-16 text-danger mx-auto mb-4" />
        <h1 className="font-heading text-2xl font-bold text-[var(--text)] mb-2">Acesso Negado</h1>
        <p className="text-[var(--text-muted)] mb-6">
          Sua conta não possui permissões atribuídas. Contate o administrador do sistema.
        </p>
        <Button variant="outline" onClick={() => { signOut(); navigate('/login') }}>
          Sair da conta
        </Button>
      </div>
    </div>
  )
}
