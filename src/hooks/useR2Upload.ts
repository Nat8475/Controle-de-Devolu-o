import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toastStore'

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png']

export function useR2Upload() {
  const [uploading, setUploading] = useState(false)

  async function upload(file: File, folder: string): Promise<{ url: string; r2Key: string } | null> {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast('Apenas JPG e PNG são permitidos', 'err')
      return null
    }
    if (file.size > MAX_SIZE) {
      toast('Arquivo maior que 5MB', 'err')
      return null
    }

    setUploading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-presign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({ fileName: file.name, contentType: file.type, folder }),
        }
      )
      const { uploadUrl, publicUrl, r2Key } = await res.json()

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      return { url: publicUrl, r2Key }
    } catch {
      toast('Erro no upload', 'err')
      return null
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading }
}
