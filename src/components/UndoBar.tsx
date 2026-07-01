import { AnimatePresence, motion } from 'framer-motion'
import { useUndoStore } from '@/stores/undoStore'

export function UndoBar() {
  const { message, execute, dismiss, durationMs, token } = useUndoStore()

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          exit={{ y: 80 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-20 md:bottom-4 right-4 z-40 bg-[#1E293B] text-white rounded-btn shadow-soft-lg flex flex-col gap-2 px-4 py-3 text-sm overflow-hidden"
        >
          <div className="flex items-center gap-3">
            <span>{message}</span>
            <button
              onClick={execute}
              className="font-semibold text-blue-300 hover:text-blue-200 underline underline-offset-2"
            >
              Desfazer
            </button>
            <button onClick={dismiss} className="text-slate-400 hover:text-white ml-1 text-xs">✕</button>
          </div>

          <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
            <motion.div
              key={token}
              className="h-full bg-blue-300/80 rounded-full"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: durationMs / 1000, ease: 'linear' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
