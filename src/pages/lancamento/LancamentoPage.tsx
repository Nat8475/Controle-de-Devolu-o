import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LancamentoForm } from './LancamentoForm'

export default function LancamentoPage() {
  return (
    <div className="p-6 max-w-3xl">
      <h2 className="font-heading text-xl font-bold text-[var(--text)] mb-6">Lançamento de NF</h2>
      <Tabs defaultValue="individual">
        <TabsList>
          <TabsTrigger value="individual">Individual</TabsTrigger>
          <TabsTrigger value="lote">Em Lote</TabsTrigger>
        </TabsList>
        <TabsContent value="individual" className="mt-6">
          <LancamentoForm />
        </TabsContent>
        <TabsContent value="lote" className="mt-6">
          <p className="text-[var(--text-muted)] text-sm">Modo lote: adicione múltiplos itens e salve todos de uma vez.</p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
