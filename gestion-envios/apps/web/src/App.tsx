import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { PrimerAccesoPage } from "@/pages/PrimerAccesoPage";
import { TrackingPage } from "@/pages/TrackingPage";
import { AccesoDenegadoPage } from "@/pages/AccesoDenegadoPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { EnviosListPage } from "@/pages/envios/EnviosListPage";
import { EnvioNuevoPage } from "@/pages/envios/EnvioNuevoPage";
import { EnvioDetallePage } from "@/pages/envios/EnvioDetallePage";
import { RutasListPage } from "@/pages/rutas/RutasListPage";
import { RutaNuevaPage } from "@/pages/rutas/RutaNuevaPage";
import { RutaDetallePage } from "@/pages/rutas/RutaDetallePage";
import { RepartidoresListPage } from "@/pages/repartidores/RepartidoresListPage";
import { RepartidorDetallePage } from "@/pages/repartidores/RepartidorDetallePage";
import { UsuariosListPage } from "@/pages/usuarios/UsuariosListPage";
import { UsuarioNuevoPage } from "@/pages/usuarios/UsuarioNuevoPage";
import { OperacionesPage } from "@/pages/OperacionesPage";
import { ReportesPage } from "@/pages/ReportesPage";
import { WhatsappConfigPage } from "@/pages/WhatsappConfigPage";
import { RutaMapaPage } from "@/pages/rutas/RutaMapaPage";
import { lazy, Suspense } from "react";
import { SkeletonPagina } from "@/components/ui/Skeleton";

const VehiculosPage = lazy(() => import("@/pages/VehiculosPage").then((m) => ({ default: m.VehiculosPage })));
const Ruta3DPage = lazy(() => import("@/pages/rutas/Ruta3DPage").then((m) => ({ default: m.Ruta3DPage })));

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/primer-acceso" element={<PrimerAccesoPage />} />
          <Route path="/tracking" element={<TrackingPage />} />
          <Route path="/tracking/:codigo" element={<TrackingPage />} />
          <Route path="/acceso-denegado" element={<AccesoDenegadoPage />} />

          <Route element={<ProtectedRoute allow={["operador", "admin"]} />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/operaciones" replace />} />
              <Route path="operaciones" element={<OperacionesPage />} />
              <Route path="reportes" element={<ReportesPage />} />
              <Route path="vehiculos" element={<Suspense fallback={<SkeletonPagina label="Cargando vehículos…" />}><VehiculosPage /></Suspense>} />

              <Route path="envios" element={<EnviosListPage />} />
              <Route path="envios/nuevo" element={<EnvioNuevoPage />} />
              <Route path="envios/:id" element={<EnvioDetallePage />} />

              <Route path="rutas" element={<RutasListPage />} />
              <Route path="rutas/nueva" element={<RutaNuevaPage />} />
              <Route path="rutas/:id" element={<RutaDetallePage />} />
              <Route path="rutas/:id/mapa" element={<RutaMapaPage />} />
              <Route path="rutas/:id/3d" element={<Suspense fallback={<SkeletonPagina label="Cargando vista 3D…" />}><Ruta3DPage /></Suspense>} />

              <Route path="repartidores" element={<RepartidoresListPage />} />
              <Route path="repartidores/:id" element={<RepartidorDetallePage />} />

              <Route element={<ProtectedRoute allow={["admin"]} />}>
                <Route path="usuarios" element={<UsuariosListPage />} />
                <Route path="usuarios/nuevo" element={<UsuarioNuevoPage />} />
                <Route path="configuracion/whatsapp" element={<WhatsappConfigPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
