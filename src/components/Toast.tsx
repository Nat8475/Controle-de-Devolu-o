import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore } from '@/stores/toastStore'
import { cn } from '@/lib/utils'

const ICONS = {
  ok: <CheckCircle className="w-4 h-4" />,
  err: <XCircle className="w-4 h-4" />,
  warn: <AlertTriangle className="w-4 h-4" />,
  info: <Info className="w-4 h-4" />,
}

const CLASSES = {
  ok: 'bg-positive text-white',
  err: 'bg-danger text-white',
  warn: 'bg-warning text-white',
  info: 'bg-primary text-white',
}

export function Toast() {
  const { toasts, dismiss } = useToastStore()

  return (
    <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-btn shadow-soft-lg text-sm font-medium pointer-events-auto min-w-[220px] max-w-sm',
              CLASSES[t.type]
            )}
          >
            {ICONS[t.type]}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
