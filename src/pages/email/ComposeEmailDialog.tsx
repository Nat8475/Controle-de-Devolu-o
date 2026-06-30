import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSendEmail } from '@/hooks/useEmail'
import { useNotas } from '@/hooks/useNotas'
import type { NotaFiscal } from '@/types/database'

interface Props { open: boolean; onClose: () => void; preSelectedNota?: NotaFiscal | null }

type Template = { label: string; assunto: (n: NotaFiscal) => string; corpo: (n: NotaFiscal) => string }

const TEMPLATES: Template[] = [
  {
    label: 'Devolução de mercadoria',
    assunto: n => `Devolução - NF ${n.nf} - ${n.fornecedor}`,
    corpo: n => `
<p>Prezado Fornecedor,</p>
<p>Informamos que a <strong>Nota Fiscal ${n.nf}</strong>, emitida em ${new Date(n.data + 'T00:00:00').toLocaleDateString('pt-BR')},
no valor de ${n.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, está sendo devolvida.</p>
${n.motivo ? `<p><strong>Motivo:</strong> ${n.motivo}</p>` : ''}
${n.descricao ? `<p><strong>Descrição:</strong> ${n.descricao}</p>` : ''}
<p>Aguardamos o agendamento para devolução.</p>
<p>Atenciosamente,<br/>Equipe de Logística</p>
    `.trim(),
  },
  {
    label: 'Solicitação de NF de devolução',
    assunto: n => `Solicitação NFD - NF ${n.nf} - ${n.fornecedor}`,
    corpo: n => `
<p>Prezado Fornecedor,</p>
<p>Solicitamos a emissão da Nota Fiscal de Devolução referente à <strong>NF ${n.nf}</strong>,
emitida em ${new Date(n.data + 'T00:00:00').toLocaleDateString('pt-BR')},
no valor de ${n.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.</p>
${n.qtd ? `<p><strong>Quantidade:</strong> ${n.qtd} unidades</p>` : ''}
<p>Por favor, enviar para análise e regularização fiscal.</p>
<p>Atenciosamente,<br/>Equipe de Logística</p>
    `.trim(),
  },
  {
    label: 'Pendência sem retorno',
    assunto: n => `Pendência - NF ${n.nf} - ${n.fornecedor}`,
    corpo: n => `
<p>Prezado Fornecedor,</p>
<p>Entramos em contato para comunicar que a <strong>NF ${n.nf}</strong> encontra-se pendente
de resolução em nosso sistema desde ${new Date(n.data + 'T00:00:00').toLocaleDateString('pt-BR')}.</p>
<p>Aguardamos uma posição quanto ao prazo de atendimento desta pendência.</p>
<p>Atenciosamente,<br/>Equipe de Logística</p>
    `.trim(),
  },
  {
    label: 'Em branco',
    assunto: () => '',
    corpo: () => '',
  },
]

export function ComposeEmailDialog({ open, onClose, preSelectedNota }: Props) {
  const sendEmail = useSendEmail()
  const { data: notas = [] } = useNotas({ status: '', aba: '', dataIni: '', dataFim: '', semFrete: false, busca: '' })

  const [notaId, setNotaId] = useState(preSelectedNota?.id ?? '')
  const [templateIdx, setTemplateIdx] = useState(0)
  const [destinatarios, setDestinatarios] = useState('')
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')

  const selectedNota = notas.find(n => n.id === notaId) ?? preSelectedNota ?? null

  function applyTemplate(idx: number) {
    setTemplateIdx(idx)
    if (!selectedNota) return
    setAssunto(TEMPLATES[idx].assunto(selectedNota))
    setCorpo(TEMPLATES[idx].corpo(selectedNota))
  }

  function handleNotaChange(id: string) {
    setNotaId(id)
    const nota = notas.find(n => n.id === id)
    if (nota) {
      setAssunto(TEMPLATES[templateIdx].assunto(nota))
      setCorpo(TEMPLATES[templateIdx].corpo(nota))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const recipients = destinatarios.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)
    if (!recipients.length) return
    await sendEmail.mutateAsync({
      nota_ids: notaId ? [notaId] : [],
      destinatarios: recipients,
      assunto,
      corpo_html: corpo.replace(/\n/g, '<br/>'),
    })
    setDestinatarios('')
    setAssunto('')
    setCorpo('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-surface dark:bg-surface-dark border-[var(--border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text)]">Compor E-mail</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>NF Referência</Label>
              <select
                value={notaId}
                onChange={e => handleNotaChange(e.target.value)}
                className="w-full rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-3 py-2"
              >
                <option value="">— sem NF —</option>
                {notas.map(n => (
                  <option key={n.id} value={n.id}>NFD {n.nfd} · {n.nf} · {n.fornecedor}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Template</Label>
              <select
                value={templateIdx}
                onChange={e => applyTemplate(Number(e.target.value))}
                className="w-full rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-3 py-2"
              >
                {TEMPLATES.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Destinatários <span className="text-[var(--text-muted)] font-normal">(separe por vírgula)</span></Label>
            <Input
              type="text"
              value={destinatarios}
              onChange={e => setDestinatarios(e.target.value)}
              placeholder="email@fornecedor.com, outro@empresa.com"
              required
            />
          </div>

          <div className="space-y-1">
            <Label>Assunto</Label>
            <Input value={assunto} onChange={e => setAssunto(e.target.value)} required />
          </div>

          <div className="space-y-1">
            <Label>Corpo do e-mail</Label>
            <textarea
              value={corpo}
              onChange={e => setCorpo(e.target.value)}
              rows={10}
              required
              className="w-full rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm p-3 resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
            />
            <p className="text-xs text-[var(--text-muted)]">Suporta HTML simples (&lt;b&gt;, &lt;p&gt;, &lt;br/&gt;)</p>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-primary" disabled={sendEmail.isPending}>
              {sendEmail.isPending ? 'Enviando...' : 'Enviar E-mail'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
