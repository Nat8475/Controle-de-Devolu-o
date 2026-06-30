import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTransferenciasMutation } from '@/hooks/useTransferencias'
import type { NotaFiscal } from '@/types/database'

interface Props {
  nota: NotaFiscal | null
  open: boolean
  onClose: () => void
}

const EMPTY = { tipo: '', caixas: '', valor: '', num_pedido: '', agendamento: '' }

export function TransferenciaDialog({ nota, open, onClose }: Props) {
  const { insertTransferencia } = useTransferenciasMutation()
  const [form, setForm] = useState(EMPTY)

  function set(key: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nota) return
    await insertTransferencia.mutateAsync({
      nota_fiscal_id: nota.id,
      nfd: nota.nfd,
      nf: nota.nf,
      tipo: form.tipo || undefined,
      caixas: form.caixas ? parseInt(form.caixas) : undefined,
      valor: form.valor ? parseFloat(form.valor) : undefined,
      num_pedido: form.num_pedido || undefined,
      agendamento: form.agendamento || undefined,
    })
    setForm(EMPTY)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-surface dark:bg-surface-dark border-[var(--border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text)]">Registrar Transferência</DialogTitle>
        </DialogHeader>
        {nota && (
          <p className="text-sm text-[var(--text-muted)] -mt-2">
            NFD {nota.nfd} · {nota.fornecedor}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Input value={form.tipo} onChange={e => set('tipo', e.target.value)} placeholder="Ex: Devolução" />
            </div>
            <div className="space-y-1">
              <Label>Caixas</Label>
              <Input type="number" value={form.caixas} onChange={e => set('caixas', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={e => set('valor', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nº Pedido</Label>
              <Input value={form.num_pedido} onChange={e => set('num_pedido', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Agendamento</Label>
            <Input type="date" value={form.agendamento} onChange={e => set('agendamento', e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-primary" disabled={insertTransferencia.isPending}>
              {insertTransferencia.isPending ? 'Salvando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
