import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { TrackingPage } from "@/pages/TrackingPage";
import { AccesoDenegadoPage } from "@/pages/AccesoDenegadoPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { EnviosListPage } from "@/pages/envios/EnviosListPage";
import { EnvioNuevoPage } from "@/pages/envios/EnvioNuevoPage";
import { EnvioDetallePage } from "@/pages/envios/EnvioDetallePage";
import { RutasListPage } from "@/pages/rutas/RutasListPage";
import { RutaNuevaPage } from "@/pages/rutas/RutaNuevaPage";
import { RutaDetallePage } from "@/pages/rutas/RutaDetallePage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ReportesPage } from "@/pages/ReportesPage";
import { RutaMapaPage } from "@/pages/rutas/RutaMapaPage";
import { UsuariosListPage } from "@/pages/usuarios/UsuariosListPage";
import { UsuarioNuevoPage } from "@/pages/usuarios/UsuarioNuevoPage";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/tracking" element={<TrackingPage />} />
          <Route path="/acceso-denegado" element={<AccesoDenegadoPage />} />

          <Route element={<ProtectedRoute allow={["operador", "supervisor"]} />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/envios" replace />} />

              <Route path="envios" element={<EnviosListPage />} />
              <Route path="envios/nuevo" element={<EnvioNuevoPage />} />
              <Route path="envios/:id" element={<EnvioDetallePage />} />

              <Route path="rutas" element={<RutasListPage />} />
              <Route path="rutas/nueva" element={<RutaNuevaPage />} />
              <Route path="rutas/:id" element={<RutaDetallePage />} />
              <Route path="rutas/:id/mapa" element={<RutaMapaPage />} />

              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="reportes" element={<ReportesPage />} />

              <Route element={<ProtectedRoute allow={["supervisor"]} />}>
                <Route path="usuarios" element={<UsuariosListPage />} />
                <Route path="usuarios/nuevo" element={<UsuarioNuevoPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
