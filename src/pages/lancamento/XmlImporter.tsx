import { Upload } from 'lucide-react'

interface ParsedXml {
  nf: string
  data: string
  fornecedor: string
  valor: number
  qtd: number
  descricao: string
}

interface Props { onParsed: (data: ParsedXml) => void }

export function XmlImporter({ onParsed }: Props) {
  function parseXml(xmlString: string): ParsedXml | null {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlString, 'text/xml')
    if (doc.querySelector('parsererror')) return null

    const nNF = doc.querySelector('nNF')?.textContent?.trim() ?? ''
    const dhEmi = doc.querySelector('dhEmi')?.textContent?.trim() ?? ''
    const xNome = doc.querySelector('emit > xNome')?.textContent?.trim() ?? ''
    const vNF = doc.querySelector('vNF')?.textContent?.trim() ?? '0'
    const data = dhEmi ? dhEmi.slice(0, 10) : ''

    // Produtos: NF-e pode ter múltiplos <det><prod>. Soma qCom e concatena até 3 xProd.
    const dets = Array.from(doc.querySelectorAll('det'))
    let qtdTotal = 0
    const xProds: string[] = []
    for (const det of dets) {
      const qCom = parseFloat(det.querySelector('prod > qCom')?.textContent?.trim() ?? '0')
      const xProd = det.querySelector('prod > xProd')?.textContent?.trim() ?? ''
      if (!isNaN(qCom)) qtdTotal += qCom
      if (xProd) xProds.push(xProd)
    }
    const descricao = xProds.slice(0, 3).join('; ')

    return {
      nf: nNF,
      data,
      fornecedor: xNome.toUpperCase(),
      valor: parseFloat(vNF) || 0,
      qtd: Math.round(qtdTotal),
      descricao,
    }
  }

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const xml = e.target?.result as string
      const parsed = parseXml(xml)
      if (parsed) onParsed(parsed)
    }
    reader.readAsText(file)
  }

  return (
    <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-[var(--border)] rounded-btn cursor-pointer hover:border-primary/50 transition-colors text-sm text-[var(--text-muted)]">
      <Upload className="w-4 h-4" />
      Importar XML NF-e
      <input type="file" accept=".xml" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
    </label>
  )
}
