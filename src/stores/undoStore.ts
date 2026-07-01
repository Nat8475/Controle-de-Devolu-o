import { create } from 'zustand'

interface UndoState {
  message: string | null
  onUndo: (() => void) | null
  timeoutId: ReturnType<typeof setTimeout> | null
  durationMs: number
  /** Incremented every time show() is called, so the UI can restart progress animations. */
  token: number
  show: (message: string, onUndo: () => void, durationMs?: number) => void
  execute: () => void
  dismiss: () => void
}

export const useUndoStore = create<UndoState>((set, get) => ({
  message: null,
  onUndo: null,
  timeoutId: null,
  durationMs: 15000,
  token: 0,
  show: (message, onUndo, durationMs = 15000) => {
    const existing = get().timeoutId
    if (existing) clearTimeout(existing)
    const id = setTimeout(() => set({ message: null, onUndo: null, timeoutId: null }), durationMs)
    set(state => ({ message, onUndo, timeoutId: id, durationMs, token: state.token + 1 }))
  },
  execute: () => {
    const { onUndo, timeoutId } = get()
    if (timeoutId) clearTimeout(timeoutId)
    onUndo?.()
    set({ message: null, onUndo: null, timeoutId: null })
  },
  dismiss: () => {
    const { timeoutId } = get()
    if (timeoutId) clearTimeout(timeoutId)
    set({ message: null, onUndo: null, timeoutId: null })
  },
}))

export const showUndo = (message: string, onUndo: () => void, durationMs = 15000) => {
  useUndoStore.getState().show(message, onUndo, durationMs)
}
