import { create } from 'zustand'

interface UIState {
  darkMode: boolean
  cmdOpen: boolean
  toggleDark: () => void
  setCmdOpen: (open: boolean) => void
}

const savedDark = localStorage.getItem('cdv_dark_mode') === '1'
if (savedDark) document.documentElement.classList.add('dark')

export const useUIStore = create<UIState>((set, get) => ({
  darkMode: savedDark,
  cmdOpen: false,
  toggleDark: () => {
    const next = !get().darkMode
    set({ darkMode: next })
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('cdv_dark_mode', next ? '1' : '')
  },
  setCmdOpen: (open) => set({ cmdOpen: open }),
}))
