import { useNavigate } from 'react-router-dom'
import { FileText, Plus, ArrowRightLeft, Mail, Clock, CheckCircle, Truck, DollarSign } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useDashboard } from '@/hooks/useDashboard'
import { usePermission } from '@/hooks/usePermission'

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function HomePage() {
  const { profile } = useAuth()
  const { hasModule } = usePermission()
  const { data } = useDashboard()
  const navigate = useNavigate()

  const kpis = data ? [
    {
      label: 'Total de NFs',
      value: data.totalNotas,
      icon: FileText,
      color: 'bg-primary/10 text-primary',
    },
    {
      label: 'Valor em Devolução',
      value: BRL(data.valorTotal),
      icon: DollarSign,
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
    {
      label: 'Pendentes',
      value: data.byStatus['Pendente'] ?? 0,
      icon: Clock,
      color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    {
      label: 'Devolvidos',
      value: data.byStatus['Devolvido'] ?? 0,
      icon: CheckCircle,
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    },
    {
      label: 'Em Transferência',
      value: data.byStatus['Em Transferência'] ?? 0,
      icon: ArrowRightLeft,
      color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    },
    {
      label: 'Sem Frete',
      value: data.semFrete,
      icon: Truck,
      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
  ] : []

  const quickLinks = [
    { path: '/app/notas', icon: FileText, label: 'Ver Notas', desc: 'Consultar e gerenciar NFs', mod: 'notas' },
    { path: '/app/lancamento', icon: Plus, label: 'Lançar NF', desc: 'Registrar nova devolução', mod: 'lancamento' },
    { path: '/app/transferencias', icon: ArrowRightLeft, label: 'Transferências', desc: 'Acompanhar transferências ativas', mod: 'transferencias' },
    { path: '/app/email', icon: Mail, label: 'E-mails', desc: 'Comunicação com fornecedores', mod: 'email' },
  ].filter(l => hasModule(l.mod as Parameters<typeof hasModule>[0]))

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = profile?.nome?.split(' ')[0] ?? profile?.email?.split('@')[0] ?? ''

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[var(--text)]">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-[var(--text-muted)] mt-1 text-sm">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-surface dark:bg-surface-dark border border-[var(--border)] rounded-card p-4">
              <div className={`inline-flex p-2 rounded-btn mb-2 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold font-heading text-[var(--text)] leading-none">{value}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-tight">{label}</p>
            </div>
          ))}
        </div>
      )}

      {!data && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface dark:bg-surface-dark border border-[var(--border)] rounded-card p-4 animate-pulse">
              <div className="w-8 h-8 bg-[var(--border)] rounded-btn mb-2" />
              <div className="h-6 bg-[var(--border)] rounded w-12 mb-1" />
              <div className="h-3 bg-[var(--border)] rounded w-20" />
            </div>
          ))}
        </div>
      )}

      {quickLinks.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Acesso rápido</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickLinks.map(({ path, icon: Icon, label, desc }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="bg-surface dark:bg-surface-dark border border-[var(--border)] rounded-card p-4 text-left hover:border-primary/50 hover:shadow-soft transition-all group"
              >
                <Icon className="w-5 h-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {data && data.topFornecedores.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Top fornecedores</h2>
          <div className="bg-surface dark:bg-surface-dark border border-[var(--border)] rounded-card divide-y divide-[var(--border)]">
            {data.topFornecedores.slice(0, 5).map((f, i) => (
              <div key={f.nome} className="flex items-center gap-4 px-4 py-3">
                <span className="text-xs text-[var(--text-muted)] w-4 flex-shrink-0">{i + 1}</span>
                <span className="text-sm text-[var(--text)] flex-1 truncate font-medium">{f.nome}</span>
                <span className="text-xs text-[var(--text-muted)]">{f.count} NFs</span>
                <span className="text-xs font-medium text-[var(--text)] w-28 text-right">{BRL(f.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
