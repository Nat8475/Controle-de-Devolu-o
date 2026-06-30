import { Upload } from 'lucide-react'

interface ParsedXml {
  nf: string
  data: string
  fornecedor: string
  valor: number
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

    return { nf: nNF, data, fornecedor: xNome.toUpperCase(), valor: parseFloat(vNF) || 0 }
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
