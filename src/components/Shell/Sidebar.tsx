import { NavLink } from 'react-router-dom'
import {
  FileText, Plus, Mail, ArrowRightLeft,
  BarChart2, FileBarChart,
  ClipboardList, Database, Settings
} from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { cn } from '@/lib/utils'
import type { Modulo } from '@/types/database'

export const NAV_ITEMS = [
  { path: '/app/home', icon: BarChart2, label: 'Início', mod: null },
  { path: '/app/notas', icon: FileText, label: 'Notas', mod: 'notas' as Modulo },
  { path: '/app/lancamento', icon: Plus, label: 'Lançamento', mod: 'lancamento' as Modulo },
  { path: '/app/transferencias', icon: ArrowRightLeft, label: 'Transferências', mod: 'transferencias' as Modulo },
  { path: '/app/email', icon: Mail, label: 'E-mail', mod: 'email' as Modulo },
  { path: '/app/dashboard', icon: BarChart2, label: 'Dashboard', mod: 'dashboard' as Modulo },
  { path: '/app/relatorios', icon: FileBarChart, label: 'Relatórios', mod: 'relatorios' as Modulo },
  { path: '/app/auditoria', icon: ClipboardList, label: 'Auditoria', mod: 'auditoria' as Modulo },
  { path: '/app/backup', icon: Database, label: 'Backup', mod: 'backup' as Modulo },
  { path: '/app/configuracoes', icon: Settings, label: 'Configurações', mod: 'configuracoes' as Modulo },
]

export function Sidebar() {
  const { hasModule } = usePermission()
  const visible = NAV_ITEMS.filter(item => !item.mod || hasModule(item.mod))

  return (
    <nav className="hidden md:flex flex-col w-56 min-h-screen bg-surface dark:bg-surface-dark border-r border-[var(--border)] pt-2 pb-4 overflow-y-auto flex-shrink-0">
      {visible.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-btn text-sm transition-colors',
              isActive
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]'
            )
          }
        >
          <item.icon className="w-4 h-4 flex-shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
