import { NavLink } from 'react-router-dom'
import { FileText, Plus, ArrowRightLeft, BarChart2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const BOTTOM_ITEMS = [
  { path: '/app/home', icon: BarChart2, label: 'Início' },
  { path: '/app/notas', icon: FileText, label: 'Notas' },
  { path: '/app/lancamento', icon: Plus, label: 'Lançar' },
  { path: '/app/transferencias', icon: ArrowRightLeft, label: 'Transf.' },
  { path: '/app/configuracoes', icon: Settings, label: 'Config.' },
]

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface dark:bg-surface-dark border-t border-[var(--border)] flex z-40">
      {BOTTOM_ITEMS.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors',
              isActive ? 'text-primary' : 'text-[var(--text-muted)]'
            )
          }
        >
          <item.icon className="w-5 h-5" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
