import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { LoginPage } from '../features/auth/LoginPage'
import { RestablecerContrasenaPage } from '../features/auth/RestablecerContrasenaPage'
import { BioinsumosPage } from '../features/bioinsumos/BioinsumosPage'
import { CafePage } from '../features/cafe/CafePage'
import { ComercialPage } from '../features/comercial/ComercialPage'
import { CosechasPage } from '../features/cosechas/CosechasPage'
import { EvidenciasPage } from '../features/evidencias/EvidenciasPage'
import { FincaDetailPage } from '../features/fincas/FincaDetailPage'
import { FincasPage } from '../features/fincas/FincasPage'
import { InicioPage } from '../features/inicio/InicioPage'
import { LaboresPage } from '../features/labores/LaboresPage'
import { LaborWizard } from '../features/labores/LaborWizard'
import { LoteDetailPage } from '../features/lotes/LoteDetailPage'
import { LotesPage } from '../features/lotes/LotesPage'
import { PortalPublico } from '../features/publicaciones/PortalPublico'
import { ReportesPage } from '../features/reportes/ReportesPage'
import { RangosPage } from '../features/suelos/RangosPage'
import { SuelosPage } from '../features/suelos/SuelosPage'
import { TrazabilidadPage } from '../features/trazabilidad/TrazabilidadPage'
import { UsuariosPage } from '../features/usuarios/UsuariosPage'
import { AuthProvider } from '../shared/auth/AuthProvider'
import { useAuth } from '../shared/auth/context'
import { ActiveFarmProvider } from '../shared/farm/ActiveFarmProvider'
import { Loading } from '../shared/ui'
import { AppLayout } from './AppLayout'

function Panel() {
  return (
    <ActiveFarmProvider>
      <AppLayout />
    </ActiveFarmProvider>
  )
}

export function AppRoutes() {
  const { token, loading } = useAuth()
  if (loading) return <Loading label="Verificando sesión…" />
  return (
    <Routes>
      <Route index element={<PortalPublico />} />
      <Route path="ingresar" element={token ? <Navigate to="/inicio" replace /> : <LoginPage />} />
      <Route path="restablecer-contrasena" element={<RestablecerContrasenaPage />} />
      <Route element={token ? <Panel /> : <Navigate to="/ingresar" replace />}>
        <Route path="inicio" element={<InicioPage />} />
        <Route path="fincas" element={<FincasPage />} />
        <Route path="fincas/:farmId" element={<FincaDetailPage />} />
        <Route path="lotes" element={<LotesPage />} />
        <Route path="lotes/:lotId" element={<LoteDetailPage />} />
        <Route path="labores" element={<LaboresPage />} />
        <Route path="labores/nueva" element={<LaborWizard />} />
        <Route path="cosechas" element={<CosechasPage />} />
        <Route path="suelos" element={<SuelosPage />} />
        <Route path="suelos/rangos" element={<RangosPage />} />
        <Route path="bioinsumos" element={<BioinsumosPage />} />
        <Route path="cafe" element={<CafePage />} />
        <Route path="trazabilidad" element={<TrazabilidadPage />} />
        <Route path="comercial" element={<ComercialPage />} />
        <Route path="evidencias" element={<EvidenciasPage />} />
        <Route path="reportes" element={<ReportesPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />
      </Route>
      <Route path="*" element={<Navigate to={token ? '/inicio' : '/'} replace />} />
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
