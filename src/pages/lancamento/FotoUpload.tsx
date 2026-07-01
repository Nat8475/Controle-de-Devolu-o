import { useCallback, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { useR2Upload } from '@/hooks/useR2Upload'
import { cn } from '@/lib/utils'
import { toast } from '@/stores/toastStore'

interface UploadedPhoto { url: string; r2Key: string; preview: string; fileName: string }

interface Props {
  folder: string
  onUploaded: (photos: Array<{ url: string; r2Key: string }>) => void
}

export function FotoUpload({ folder, onUploaded }: Props) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [dragging, setDragging] = useState(false)
  const { upload, uploading } = useR2Upload()

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, 10 - photos.length)
    for (const file of arr) {
      if (photos.some(p => p.fileName === file.name)) {
        toast(`Arquivo "${file.name}" já foi adicionado`, 'err')
        continue
      }
      const preview = URL.createObjectURL(file)
      const result = await upload(file, folder)
      if (result) {
        setPhotos(prev => {
          const next = [...prev, { ...result, preview, fileName: file.name }]
          onUploaded(next.map(p => ({ url: p.url, r2Key: p.r2Key })))
          return next
        })
      }
    }
  }, [photos, upload, folder, onUploaded])

  function removePhoto(r2Key: string) {
    setPhotos(prev => {
      const next = prev.filter(p => p.r2Key !== r2Key)
      onUploaded(next.map(p => ({ url: p.url, r2Key: p.r2Key })))
      return next
    })
  }

  return (
    <div className="space-y-3">
      <label
        className={cn(
          'flex flex-col items-center justify-center border-2 border-dashed rounded-card p-8 cursor-pointer transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-[var(--border)] hover:border-primary/50'
        )}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files) }}
      >
        <input
          type="file"
          accept="image/jpeg,image/png"
          multiple
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
        />
        <Upload className={cn('w-8 h-8 mb-2', uploading ? 'text-primary animate-bounce' : 'text-[var(--text-muted)]')} />
        <p className="text-sm text-[var(--text-muted)]">
          {uploading ? 'Enviando...' : 'Arraste fotos ou clique para selecionar (JPG/PNG, máx 5MB)'}
        </p>
      </label>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map(p => (
            <div key={p.r2Key} className="relative group">
              <img src={p.preview} className="w-full h-20 object-cover rounded-btn" />
              <button
                onClick={() => removePhoto(p.r2Key)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
