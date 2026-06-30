export type SupabaseStatus = 'Pendente' | 'Em Transferência' | 'Devolvido' | 'Cancelado' | 'Vendido'
export type SupabaseAba = 'Britania' | 'Unilever' | 'Variados'
export type Modulo =
  | 'notas'
  | 'lancamento'
  | 'email'
  | 'transferencias'
  | 'relatorios'
  | 'auditoria'
  | 'backup'
  | 'configuracoes'
  | 'dashboard'

export type FreteTipo = 'Tabela' | 'Valor+ICMS' | 'Valor' | 'Cortesia'

export interface Profile {
  id: string
  email: string
  nome: string | null
  avatar_url: string | null
  is_admin: boolean
  created_at: string
}

export interface Cargo {
  id: string
  nome: string
  created_at: string
}

export interface CargoModulo {
  cargo_id: string
  modulo: Modulo
}

export interface UsuarioCargo {
  user_id: string
  cargo_id: string
  atribuido_por: string | null
  created_at: string
}

export interface NotaFiscal {
  id: string
  nfd: string
  nf: string
  data: string
  fornecedor: string
  aba: SupabaseAba
  tipo: string | null
  motivo: string | null
  descricao: string | null
  qtd: number
  valor_unitario: number
  valor_total: number
  status: SupabaseStatus
  obs: string | null
  responsavel_id: string | null
  frete_tipo: FreteTipo | null
  frete_valor: number | null
  dias_armazem: number
  anexo_url: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Transferencia {
  id: string
  nota_fiscal_id: string
  nfd: string
  nf: string
  tipo: string | null
  caixas: number | null
  valor: number | null
  num_pedido: string | null
  agendamento: string | null
  status: 'Ativa' | 'Concluída' | 'Cancelada'
  created_at: string
}

export interface FotoNF {
  id: string
  nota_fiscal_id: string
  url: string
  r2_key: string
  nome: string | null
  ordem: number
  created_at: string
}

export interface Comentario {
  id: string
  nota_fiscal_id: string
  user_id: string
  texto: string
  created_at: string
}

export interface EmailLog {
  id: string
  nota_ids: string[]
  destinatarios: string[]
  assunto: string | null
  corpo_html: string | null
  status: 'enviado' | 'agendado' | 'erro'
  agendado_para: string | null
  enviado_em: string | null
  created_by: string | null
  created_at: string
}

export interface RespostaFornecedor {
  id: string
  nota_fiscal_id: string
  user_id: string
  texto: string
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  acao: string
  tabela: string | null
  registro_id: string | null
  dados_antes: Record<string, unknown> | null
  dados_depois: Record<string, unknown> | null
  created_at: string
}

export interface Config {
  chave: string
  valor: unknown
  updated_at: string
  updated_by: string | null
}

export interface Backup {
  id: string
  nome: string
  tamanho_bytes: number | null
  r2_key: string
  created_by: string | null
  created_at: string
}
