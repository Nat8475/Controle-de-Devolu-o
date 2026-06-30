import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface DashboardNota {
  id: string
  data: string
  status: string
  aba: string
  fornecedor: string
  valor_total: number
  frete_tipo: string | null
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7)
}

function monthLabel(key: string) {
  const [year, month] = key.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_fiscais')
        .select('id, data, status, aba, fornecedor, valor_total, frete_tipo')
        .is('deleted_at', null)
        .order('data', { ascending: false })
      if (error) throw error
      const notas = data as DashboardNota[]

      const totalNotas = notas.length
      const valorTotal = notas.reduce((s, n) => s + (n.valor_total ?? 0), 0)
      const semFrete = notas.filter(n => !n.frete_tipo).length

      const byStatus = notas.reduce<Record<string, number>>((acc, n) => {
        acc[n.status] = (acc[n.status] ?? 0) + 1
        return acc
      }, {})

      const byAba = notas.reduce<Record<string, { count: number; valor: number }>>((acc, n) => {
        if (!acc[n.aba]) acc[n.aba] = { count: 0, valor: 0 }
        acc[n.aba].count++
        acc[n.aba].valor += n.valor_total ?? 0
        return acc
      }, {})

      const fornecedorMap = notas.reduce<Record<string, { count: number; valor: number }>>((acc, n) => {
        if (!acc[n.fornecedor]) acc[n.fornecedor] = { count: 0, valor: 0 }
        acc[n.fornecedor].count++
        acc[n.fornecedor].valor += n.valor_total ?? 0
        return acc
      }, {})
      const topFornecedores = Object.entries(fornecedorMap)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 8)
        .map(([nome, v]) => ({ nome, ...v }))

      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date()
        d.setMonth(d.getMonth() - (5 - i))
        return monthKey(d.toISOString())
      })
      const monthMap = notas.reduce<Record<string, number>>((acc, n) => {
        const k = monthKey(n.data)
        acc[k] = (acc[k] ?? 0) + 1
        return acc
      }, {})
      const porMes = last6Months.map(k => ({ mes: monthLabel(k), count: monthMap[k] ?? 0 }))

      const statusChartData = Object.entries(byStatus).map(([name, value]) => ({ name, value }))
      const abaChartData = Object.entries(byAba).map(([name, v]) => ({ name, count: v.count, valor: v.valor }))

      return { totalNotas, valorTotal, semFrete, byStatus, porMes, statusChartData, abaChartData, topFornecedores }
    },
    staleTime: 60_000,
  })
}
