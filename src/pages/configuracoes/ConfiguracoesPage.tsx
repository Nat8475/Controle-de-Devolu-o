import { useState, useRef } from 'react'
import { Settings, Users, Shield, Save, Plus, Trash2, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useConfigs, useUpdateConfig, useProfiles, useCargos, useAssignCargo, useCreateCargo, useDeleteCargo } from '@/hooks/useAdmin'
import { useAssinaturas, useUpdateAssinaturas } from '@/hooks/useEmail'
import { useR2Upload } from '@/hooks/useR2Upload'
import type { Modulo } from '@/types/database'

function AssinaturasTab() {
  const { data: assinaturas = [], isLoading } = useAssinaturas()
  const updateAssinaturas = useUpdateAssinaturas()
  const { upload, uploading } = useR2Upload()
  const [novoNome, setNovoNome] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !novoNome.trim()) return
    const result = await upload(file, 'assinaturas')
    if (!result) return
    await updateAssinaturas.mutateAsync([...assinaturas, { nome: novoNome.trim(), url: result.url }])
    setNovoNome('')
    e.target.value = ''
  }

  function remover(url: string) {
    updateAssinaturas.mutate(assinaturas.filter(a => a.url !== url))
  }

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-xs text-[var(--text-muted)]">
        Imagens de assinatura usadas nos e-mails de devolução (armazenadas no R2).
        Formatos aceitos: JPG ou PNG, máx. 5 MB.
      </p>

      {isLoading && <p className="text-sm text-[var(--text-muted)]">Carregando...</p>}

      <div className="space-y-2">
        {assinaturas.map(a => (
          <div key={a.url} className="flex items-center gap-3 border border-[var(--border)] rounded-btn px-3 py-2 bg-surface dark:bg-surface-dark">
            <img src={a.url} alt={a.nome} className="h-10 max-w-[140px] object-contain rounded border border-[var(--border)]" />
            <span className="flex-1 text-sm text-[var(--text)] truncate">{a.nome}</span>
            <Button
              size="sm" variant="outline"
              className="h-7 w-7 p-0 text-red-500 hover:text-red-600 flex-shrink-0"
              onClick={() => window.confirm(`Remover "${a.nome}"?`) && remover(a.url)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
        {assinaturas.length === 0 && !isLoading && (
          <p className="text-sm text-[var(--text-muted)]">Nenhuma assinatura cadastrada.</p>
        )}
      </div>

      <div className="border border-dashed border-[var(--border)] rounded-card p-4 space-y-3">
        <p className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
          <Plus className="w-4 h-4" />Nova Assinatura
        </p>
        <div className="space-y-1">
          <Label className="text-xs">Nome de exibição</Label>
          <Input
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            placeholder="Ex: Natã Da Rosa — TransBen"
            className="text-sm"
          />
        </div>
        <Button
          className="bg-primary gap-2"
          disabled={!novoNome.trim() || uploading || updateAssinaturas.isPending}
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon className="w-4 h-4" />
          {uploading ? 'Enviando...' : 'Selecionar imagem e salvar'}
        </Button>
        <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={handleUpload} />
      </div>
    </div>
  )
}

const ALL_MODULOS: Modulo[] = ['notas', 'lancamento', 'email', 'transferencias', 'relatorios', 'dashboard', 'auditoria', 'backup', 'configuracoes']
const MODULO_LABELS: Record<Modulo, string> = {
  notas: 'Notas', lancamento: 'Lançamento', email: 'E-mail', transferencias: 'Transferências',
  relatorios: 'Relatórios', dashboard: 'Dashboard', auditoria: 'Auditoria', backup: 'Backup', configuracoes: 'Configurações',
}

const CONFIG_LABELS: Record<string, string> = {
  alert_days_threshold: 'Alerta de NFs antigas (dias)',
  email_from_name: 'Nome remetente de e-mail',
  dark_mode_default: 'Dark mode por padrão',
}

function GeralTab() {
  const { data: configs = [] } = useConfigs()
  const updateConfig = useUpdateConfig()
  const [values, setValues] = useState<Record<string, string>>({})

  const edited = (chave: string) => values[chave] !== undefined ? values[chave] : String(
    (configs.find(c => c.chave === chave)?.valor ?? '').toString().replace(/^"|"$/g, '')
  )

  return (
    <div className="space-y-4 max-w-lg">
      {configs.length === 0 && <p className="text-sm text-[var(--text-muted)]">Carregando configurações...</p>}
      {configs.map(c => (
        <div key={c.chave} className="space-y-1">
          <Label className="text-xs">{CONFIG_LABELS[c.chave] ?? c.chave}</Label>
          <div className="flex gap-2">
            <Input
              value={edited(c.chave)}
              onChange={e => setValues(v => ({ ...v, [c.chave]: e.target.value }))}
              className="text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              className="flex-shrink-0"
              onClick={() => {
                const v = edited(c.chave)
                const parsed = v === 'true' ? true : v === 'false' ? false : isNaN(Number(v)) ? v : Number(v)
                updateConfig.mutate({ chave: c.chave, valor: parsed })
                setValues(prev => { const n = { ...prev }; delete n[c.chave]; return n })
              }}
            >
              <Save className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function UsuariosTab() {
  const { data: profiles = [] } = useProfiles()
  const { data: cargos = [] } = useCargos()
  const assignCargo = useAssignCargo()

  return (
    <div className="space-y-2">
      {profiles.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum usuário encontrado.</p>}
      {profiles.map(p => {
        const currentCargo = p.usuario_cargos?.[0]
        return (
          <div key={p.id} className="flex items-center gap-4 border border-[var(--border)] rounded-btn px-4 py-3 bg-surface dark:bg-surface-dark">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text)]">{p.nome ?? p.email}</p>
              <p className="text-xs text-[var(--text-muted)]">{p.email} {p.is_admin && <span className="ml-1 text-primary font-medium">• Admin</span>}</p>
            </div>
            <select
              value={currentCargo?.cargo_id ?? ''}
              onChange={e => assignCargo.mutate({ userId: p.id, cargoId: e.target.value || null })}
              className="rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-3 py-1.5"
            >
              <option value="">— sem cargo —</option>
              {cargos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )
      })}
    </div>
  )
}

function CargosTab() {
  const { data: cargos = [] } = useCargos()
  const createCargo = useCreateCargo()
  const deleteCargo = useDeleteCargo()
  const [novaNome, setNovaNome] = useState('')
  const [novaModulos, setNovaModulos] = useState<Modulo[]>([])

  function toggleModulo(m: Modulo) {
    setNovaModulos(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!novaNome.trim()) return
    await createCargo.mutateAsync({ nome: novaNome.trim(), modulos: novaModulos })
    setNovaNome('')
    setNovaModulos([])
  }

  return (
    <div className="space-y-6">
      {/* Existing cargos */}
      <div className="space-y-2">
        {cargos.map(c => (
          <div key={c.id} className="border border-[var(--border)] rounded-btn px-4 py-3 bg-surface dark:bg-surface-dark">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-[var(--text)]">{c.nome}</p>
              <Button
                size="sm" variant="outline"
                className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                onClick={() => window.confirm(`Remover cargo "${c.nome}"?`) && deleteCargo.mutate(c.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {c.cargo_modulos.map(m => (
                <span key={m.modulo} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                  {MODULO_LABELS[m.modulo]}
                </span>
              ))}
              {c.cargo_modulos.length === 0 && <span className="text-xs text-[var(--text-muted)]">Sem módulos</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Create new cargo */}
      <div className="border border-dashed border-[var(--border)] rounded-card p-4 space-y-3">
        <p className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
          <Plus className="w-4 h-4" />Novo Cargo
        </p>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome do cargo</Label>
            <Input value={novaNome} onChange={e => setNovaNome(e.target.value)} placeholder="Ex: Supervisor" className="text-sm" required />
          </div>
          <div>
            <Label className="text-xs mb-2 block">Módulos</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_MODULOS.map(m => (
                <button
                  key={m} type="button"
                  onClick={() => toggleModulo(m)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    novaModulos.includes(m)
                      ? 'bg-primary text-white border-primary'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:border-primary hover:text-primary'
                  }`}
                >
                  {MODULO_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="bg-primary" disabled={createCargo.isPending}>
            {createCargo.isPending ? 'Criando...' : 'Criar Cargo'}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function ConfiguracoesPage() {
  return (
    <div className="p-6 max-w-3xl">
      <h2 className="font-heading text-xl font-bold text-[var(--text)] flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5" />
        Configurações
      </h2>
      <Tabs defaultValue="geral">
        <TabsList className="mb-6">
          <TabsTrigger value="geral" className="gap-1.5"><Settings className="w-3.5 h-3.5" />Geral</TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-1.5"><Users className="w-3.5 h-3.5" />Usuários</TabsTrigger>
          <TabsTrigger value="cargos" className="gap-1.5"><Shield className="w-3.5 h-3.5" />Cargos</TabsTrigger>
          <TabsTrigger value="assinaturas" className="gap-1.5"><ImageIcon className="w-3.5 h-3.5" />Assinaturas</TabsTrigger>
        </TabsList>
        <TabsContent value="geral"><GeralTab /></TabsContent>
        <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
        <TabsContent value="cargos"><CargosTab /></TabsContent>
        <TabsContent value="assinaturas"><AssinaturasTab /></TabsContent>
      </Tabs>
    </div>
  )
}
