import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import { useUIStore } from '@/stores/uiStore'
import { usePermission } from '@/hooks/usePermission'
import { NAV_ITEMS } from '@/components/Shell/Sidebar'

export function CommandPalette() {
  const { cmdOpen, setCmdOpen } = useUIStore()
  const { hasModule } = usePermission()
  const navigate = useNavigate()

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [setCmdOpen])

  function go(path: string) {
    navigate(path)
    setCmdOpen(false)
  }

  if (!cmdOpen) return null

  const items = NAV_ITEMS.filter(item => !item.mod || hasModule(item.mod))

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-[15vh]"
      onClick={() => setCmdOpen(false)}
    >
      <div
        className="w-full max-w-lg bg-surface dark:bg-surface-dark rounded-card shadow-soft-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <Command>
          <div className="border-b border-[var(--border)] px-4">
            <Command.Input
              autoFocus
              placeholder="Buscar módulo ou ação..."
              className="w-full py-3 bg-transparent text-[var(--text)] outline-none text-sm placeholder:text-[var(--text-muted)]"
            />
          </div>
          <Command.List className="max-h-72 overflow-y-auto py-2">
            <Command.Empty className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
              Nenhum resultado encontrado.
            </Command.Empty>
            {items.map(item => (
              <Command.Item
                key={item.path}
                onSelect={() => go(item.path)}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm text-[var(--text)] hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
