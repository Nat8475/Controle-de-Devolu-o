import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { useDashboard } from '@/hooks/useDashboard'
import { FileText, DollarSign, Truck, Clock, ArrowRightLeft, CheckCircle } from 'lucide-react'

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_COLORS: Record<string, string> = {
  'Pendente': '#f59e0b',
  'Em Transferência': '#3b82f6',
  'Devolvido': '#10b981',
  'Cancelado': '#ef4444',
  'Vendido': '#8b5cf6',
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  'Pendente': Clock,
  'Em Transferência': ArrowRightLeft,
  'Devolvido': CheckCircle,
  'Cancelado': FileText,
  'Vendido': DollarSign,
}

const ABA_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b']

interface KpiCardProps { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }
function KpiCard({ label, value, sub, icon: Icon, color }: KpiCardProps) {
  return (
    <div className="bg-surface dark:bg-surface-dark border border-[var(--border)] rounded-card p-4 flex items-start gap-4">
      <div className={`p-2.5 rounded-btn ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-2xl font-bold font-heading text-[var(--text)]">{value}</p>
        {sub && <p className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboard()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <h2 className="font-heading text-xl font-bold text-[var(--text)]">Dashboard</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total de NFs"
          value={data.totalNotas}
          icon={FileText}
          color="bg-primary/10 text-primary"
        />
        <KpiCard
          label="Valor Total"
          value={BRL(data.valorTotal)}
          icon={DollarSign}
          color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        />
        <KpiCard
          label="Pendentes"
          value={data.byStatus['Pendente'] ?? 0}
          sub="aguardando ação"
          icon={Clock}
          color="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
        />
        <KpiCard
          label="Sem Frete"
          value={data.semFrete}
          sub="pendente de informação"
          icon={Truck}
          color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        />
      </div>

      {/* Status cards row */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
        {['Pendente', 'Em Transferência', 'Devolvido', 'Cancelado', 'Vendido'].map(s => {
          const Icon = STATUS_ICONS[s]
          const count = data.byStatus[s] ?? 0
          const pct = data.totalNotas > 0 ? Math.round((count / data.totalNotas) * 100) : 0
          return (
            <div key={s} className="bg-surface dark:bg-surface-dark border border-[var(--border)] rounded-card p-3 text-center">
              <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: STATUS_COLORS[s] }} />
              <p className="text-lg font-bold text-[var(--text)]">{count}</p>
              <p className="text-xs text-[var(--text-muted)] leading-tight">{s}</p>
              <p className="text-xs font-medium mt-1" style={{ color: STATUS_COLORS[s] }}>{pct}%</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* NFs por Mês */}
        <div className="bg-surface dark:bg-surface-dark border border-[var(--border)] rounded-card p-4">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">NFs por Mês (últimos 6 meses)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.porMes} barSize={28}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--text)' }}
                cursor={{ fill: 'var(--border)', opacity: 0.4 }}
              />
              <Bar dataKey="count" name="NFs" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* NFs por Status (Donut) */}
        <div className="bg-surface dark:bg-surface-dark border border-[var(--border)] rounded-card p-4">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Distribuição por Status</h3>
          {data.statusChartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.statusChartData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.statusChartData.map(entry => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Por Aba */}
        <div className="bg-surface dark:bg-surface-dark border border-[var(--border)] rounded-card p-4">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">NFs por Aba</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.abaChartData} barSize={36}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: 'var(--border)', opacity: 0.4 }}
              />
              <Bar dataKey="count" name="NFs" radius={[4, 4, 0, 0]}>
                {data.abaChartData.map((_, i) => (
                  <Cell key={i} fill={ABA_COLORS[i % ABA_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Fornecedores */}
        <div className="bg-surface dark:bg-surface-dark border border-[var(--border)] rounded-card p-4">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Top Fornecedores</h3>
          {data.topFornecedores.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">Sem dados</div>
          ) : (
            <div className="space-y-2">
              {data.topFornecedores.map((f, i) => {
                const maxCount = data.topFornecedores[0]?.count ?? 1
                const pct = Math.round((f.count / maxCount) * 100)
                return (
                  <div key={f.nome} className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-muted)] w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-[var(--text)] truncate">{f.nome}</span>
                        <span className="text-xs text-[var(--text-muted)] ml-2 flex-shrink-0">{f.count} NFs · {BRL(f.valor)}</span>
                      </div>
                      <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
