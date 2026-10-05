import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { LoginPage } from '../features/auth/LoginPage'
import { FincaDetailPage } from '../features/fincas/FincaDetailPage'
import { FincasPage } from '../features/fincas/FincasPage'
import { LoteDetailPage } from '../features/lotes/LoteDetailPage'
import { RangosPage } from '../features/suelos/RangosPage'
import { AuthProvider } from '../shared/auth/AuthProvider'
import { useAuth } from '../shared/auth/context'
import { Loading } from '../shared/ui'
import { AppLayout } from './AppLayout'

export function AppRoutes() {
  const { token, loading } = useAuth()
  if (loading) return <Loading label="Verificando sesión…" />
  if (!token) return <LoginPage />
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/fincas" replace />} />
        <Route path="fincas" element={<FincasPage />} />
        <Route path="fincas/:farmId" element={<FincaDetailPage />} />
        <Route path="lotes/:lotId" element={<LoteDetailPage />} />
        <Route path="suelos/rangos" element={<RangosPage />} />
        <Route path="*" element={<Navigate to="/fincas" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
