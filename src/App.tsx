import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { RBACProvider } from '@/contexts/RBACContext'
import { Shell } from '@/components/Shell/Shell'
import { RequireAuth } from '@/components/RequireAuth'

import LoginPage from '@/pages/LoginPage'
import AccessDeniedPage from '@/pages/AccessDeniedPage'

const HomePage = lazy(() => import('@/pages/HomePage'))

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
)

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <RBACProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/acesso-negado" element={<AccessDeniedPage />} />

              <Route element={<RequireAuth />}>
                <Route element={<Shell />}>
                  <Route
                    path="/app/home"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <HomePage />
                      </Suspense>
                    }
                  />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/app/home" replace />} />
            </Routes>
          </BrowserRouter>
        </RBACProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
