import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { RBACProvider } from '@/contexts/RBACContext'
import { Shell } from '@/components/Shell/Shell'
import { RequireAuth } from '@/components/RequireAuth'

import LoginPage from '@/pages/LoginPage'
import AccessDeniedPage from '@/pages/AccessDeniedPage'
import { RequireModule } from '@/components/RequireModule'

const HomePage = lazy(() => import('@/pages/HomePage'))
const NotasPage = lazy(() => import('@/pages/notas/NotasPage'))
const LancamentoPage = lazy(() => import('@/pages/lancamento/LancamentoPage'))
const TransferenciasPage = lazy(() => import('@/pages/transferencias/TransferenciasPage'))
const EmailPage = lazy(() => import('@/pages/email/EmailPage'))
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const RelatoriosPage = lazy(() => import('@/pages/relatorios/RelatoriosPage'))

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
                  <Route path="/app/home" element={<Suspense fallback={<PageLoader />}><HomePage /></Suspense>} />
                  <Route path="/app/notas" element={
                    <RequireModule mod="notas">
                      <Suspense fallback={<PageLoader />}><NotasPage /></Suspense>
                    </RequireModule>
                  } />
                  <Route path="/app/lancamento" element={
                    <RequireModule mod="lancamento">
                      <Suspense fallback={<PageLoader />}><LancamentoPage /></Suspense>
                    </RequireModule>
                  } />
                  <Route path="/app/transferencias" element={
                    <RequireModule mod="transferencias">
                      <Suspense fallback={<PageLoader />}><TransferenciasPage /></Suspense>
                    </RequireModule>
                  } />
                  <Route path="/app/email" element={
                    <RequireModule mod="email">
                      <Suspense fallback={<PageLoader />}><EmailPage /></Suspense>
                    </RequireModule>
                  } />
                  <Route path="/app/dashboard" element={
                    <RequireModule mod="dashboard">
                      <Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>
                    </RequireModule>
                  } />
                  <Route path="/app/relatorios" element={
                    <RequireModule mod="relatorios">
                      <Suspense fallback={<PageLoader />}><RelatoriosPage /></Suspense>
                    </RequireModule>
                  } />
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
