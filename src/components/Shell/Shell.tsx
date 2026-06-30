import { Outlet, useLocation } from 'react-router-dom'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { CommandPalette } from '@/components/CommandPalette'
import { Toast } from '@/components/Toast'
import { UndoBar } from '@/components/UndoBar'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useHotkeys } from '@/hooks/useHotkeys'

export function Shell() {
  useHotkeys()
  const location = useLocation()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-app dark:bg-app-dark">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <BottomNav />
      <CommandPalette />
      <Toast />
      <UndoBar />
    </div>
  )
}
