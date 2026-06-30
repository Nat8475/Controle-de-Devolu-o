// Column mapping (0-indexed):
// 0=NFD, 1=NF, 2=Data, 3=Fornecedor, 4=Tipo, 5=Motivo, 6=Descricao,
// 7=Qtd, 8=ValorUnitario, 9=ValorTotal(skip), 10=Status,
// 11-13=checkboxes(skip), 14=Obs, 15=Resp(skip), 16=AnexoURL,
// 17=DiasArmaz, 18=FreteTipo, 19=FreteValor

const ABA_MAP = { britania: 'Britania', unilever: 'Unilever', variados: 'Variados' }
const STATUS_MAP = {
  'pendente': 'Pendente',
  'em transferência': 'Em Transferência',
  'em transferencia': 'Em Transferência',
  'devolvido': 'Devolvido',
  'cancelado': 'Cancelado',
  'vendido': 'Vendido',
}
const FRETE_MAP = {
  'tabela': 'Tabela',
  'valor+icms': 'Valor+ICMS',
  'valor': 'Valor',
  'cortesia': 'Cortesia',
}

function parseDate(raw) {
  if (!raw) return null
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  return null
}

function parseNumber(raw) {
  if (!raw) return 0
  const cleaned = raw.toString().replace(/[R$\s.]/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

function mapStatus(raw) {
  if (!raw) return 'Pendente'
  return STATUS_MAP[raw.trim().toLowerCase()] ?? 'Pendente'
}

function mapFrete(raw) {
  if (!raw) return null
  return FRETE_MAP[raw.trim().toLowerCase()] ?? null
}

export function transform(rawData) {
  const rows = []

  for (const [abaKey, data] of Object.entries(rawData)) {
    const aba = ABA_MAP[abaKey]

    for (const row of data) {
      const nfd = row[0]?.trim()
      const nf = row[1]?.trim()
      if (!nfd && !nf) continue

      const data_str = parseDate(row[2])
      if (!data_str) continue

      rows.push({
        nfd: nfd || '',
        nf: nf || '',
        data: data_str,
        fornecedor: (row[3] ?? '').trim().toUpperCase(),
        aba,
        tipo: row[4]?.trim() || null,
        motivo: row[5]?.trim() || null,
        descricao: row[6]?.trim() || null,
        qtd: parseInt(row[7] ?? '0', 10) || 0,
        valor_unitario: parseNumber(row[8]),
        status: mapStatus(row[10]),
        obs: row[14]?.trim() || null,
        anexo_url: row[16]?.trim() || null,
        dias_armazem: parseInt(row[17] ?? '0', 10) || 0,
        frete_tipo: mapFrete(row[18]),
        frete_valor: row[19] ? parseNumber(row[19]) : null,
      })
    }
  }

  console.log(`Transformed ${rows.length} total rows`)
  return rows
}
