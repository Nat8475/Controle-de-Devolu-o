import { create } from 'zustand'

export type ToastType = 'ok' | 'err' | 'warn' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastState {
  toasts: ToastItem[]
  show: (message: string, type: ToastType) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (message, type) => {
    const id = Math.random().toString(36).slice(2)
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3000)
  },
  dismiss: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

export const toast = (message: string, type: ToastType = 'info') => {
  useToastStore.getState().show(message, type)
}
