import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'

const HOTKEY_ROUTES: Record<string, string> = {
  '1': '/app/notas',
  '2': '/app/lancamento',
  '3': '/app/email',
  '4': '/app/transferencias',
  '5': '/app/dashboard',
  '6': '/app/relatorios',
}

export function useHotkeys() {
  const navigate = useNavigate()
  const { toggleDark } = useUIStore()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.altKey && HOTKEY_ROUTES[e.key]) {
        e.preventDefault()
        navigate(HOTKEY_ROUTES[e.key])
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        toggleDark()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, toggleDark])
}
