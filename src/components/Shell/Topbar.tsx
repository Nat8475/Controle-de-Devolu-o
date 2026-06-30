import { Moon, Sun, Search } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'

export function Topbar() {
  const { darkMode, toggleDark, setCmdOpen } = useUIStore()
  const { profile, signOut } = useAuth()

  return (
    <header className="h-14 flex items-center px-4 border-b border-[var(--border)] bg-surface dark:bg-surface-dark gap-3 flex-shrink-0">
      <span className="font-heading font-bold text-primary text-lg flex-1">
        Controle de Devoluções
      </span>

      <Button variant="ghost" size="icon" onClick={() => setCmdOpen(true)} title="Buscar (Ctrl+K)">
        <Search className="w-4 h-4" />
      </Button>

      <Button variant="ghost" size="icon" onClick={toggleDark}>
        {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </Button>

      <button
        onClick={() => signOut()}
        className="w-8 h-8 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center hover:bg-primary-hover transition-colors"
        title={profile?.nome ?? profile?.email ?? 'Usuário'}
      >
        {(profile?.nome ?? profile?.email ?? 'U')[0].toUpperCase()}
      </button>
    </header>
  )
}
