import { AnimatePresence, motion } from 'framer-motion'
import { useUndoStore } from '@/stores/undoStore'

export function UndoBar() {
  const { message, execute, dismiss } = useUndoStore()

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          exit={{ y: 80 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-20 md:bottom-4 right-4 z-40 bg-[#1E293B] text-white rounded-btn shadow-soft-lg flex items-center gap-3 px-4 py-3 text-sm"
        >
          <span>{message}</span>
          <button
            onClick={execute}
            className="font-semibold text-blue-300 hover:text-blue-200 underline underline-offset-2"
          >
            Desfazer
          </button>
          <button onClick={dismiss} className="text-slate-400 hover:text-white ml-1 text-xs">✕</button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
