import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/services/api-client";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { obtenerConfigAuth, reenviarCodigo, urlLoginGoogle } from "@/features/auth/api";
import type { DesafioLogin, Sesion } from "@/features/auth/types";
import { useBordesNavegador } from "@/hooks/useBordesNavegador";
import { ShieldCheck } from "lucide-react";
import { CodigoInput } from "@/components/ui/CodigoInput";

/** Mensajes para el ?error= con que vuelve el login con Google (T2). */
const ERRORES_GOOGLE: Record<string, string> = {
  cancelado: "Cancelaste el inicio de sesión con Google.",
  google_denied: "Google no autorizó el inicio de sesión.",
  email_no_verificado: "Tu cuenta de Google no tiene el email verificado.",
  cuenta_inactiva: "Tu usuario está dado de baja.",
  google_otra_cuenta: "Ese email ya está vinculado a otra cuenta de Google.",
  google_no_configurado: "El ingreso con Google no está habilitado.",
  codigo_no_enviado: "No pudimos enviarte el código de verificación. Probá de nuevo en un minuto.",
};

export function LoginPage() {
  const { sesion, login, verificarCodigo, abrirSesion } = useAuth();
  const navigate = useNavigate();
  useBordesNavegador("#1a1a1a");
  const location = useLocation();

  // Credenciales del admin de la demo (migrations/0002_seed.up.sql)
  // precargadas, igual que en la app móvil. autoComplete="off" evita que el
  // navegador pise la contraseña con una vieja guardada.
  const [email, setEmail] = useState("supervisor@movii.demo");
  const [password, setPassword] = useState("Movii2026!");

  // Segundo paso (HU-16): código de 6 dígitos que llega por WhatsApp.
  const [desafio, setDesafio] = useState<DesafioLogin | null>(null);
  const [codigo, setCodigo] = useState("");
  const [verificado, setVerificado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(0);

  const [error, setError] = useState<string | null>(() => {
    const e = new URLSearchParams(location.search).get("error");
    return e ? (ERRORES_GOOGLE[e] ?? "No se pudo iniciar sesión con Google.") : null;
  });
  const [enviando, setEnviando] = useState(false);
  // Feature flag del botón de Google: GET /auth/config.
  const [conGoogle, setConGoogle] = useState(false);

  useEffect(() => {
    obtenerConfigAuth()
      .then((c) => setConGoogle(c.google))
      .catch(() => setConGoogle(false));
  }, []);

  // Vuelta de Google: el token llega en el fragmento (#token=...&email=...).
  useEffect(() => {
    const datos = new URLSearchParams(location.hash.slice(1));
    const token = datos.get("token");
    if (!token) return;
    try {
      entrar(abrirSesion(token, datos.get("email") ?? ""));
    } catch {
      setError("No se pudo iniciar sesión con Google.");
    }
    // Solo al volver de Google (una vez).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (segundos <= 0) return;
    const t = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundos]);

  if (sesion) {
    const destino = (location.state as { from?: Location })?.from?.pathname ?? "/operaciones";
    return <Navigate to={destino} replace />;
  }

  function entrar(nueva: Sesion) {
    navigate(nueva.rol === "repartidor" ? "/acceso-denegado" : "/operaciones", { replace: true });
  }

  function empezarDesafio(d: DesafioLogin) {
    setDesafio(d);
    setCodigo("");
    setSegundos(60); // la API acepta un código por minuto
  }

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const t0 = performance.now();
    console.info("[login] paso 1: validando email y contraseña", { email });
    try {
      const r = await login({ email, password });
      const ms = Math.round(performance.now() - t0);
      if ("user_id" in r) {
        console.info(`[login] contraseña OK en ${ms} ms: primer acceso, hay que elegir contraseña nueva`);
        navigate("/primer-acceso", { state: r });
      } else if ("desafio_id" in r) {
        console.info(`[login] contraseña OK en ${ms} ms: se pidió el código por WhatsApp`, { telefono: r.telefono, desafio: r.desafio_id });
        empezarDesafio(r);
      } else {
        console.info(`[login] contraseña OK en ${ms} ms: sesión iniciada (sin segundo paso)`, { rol: r.rol });
        entrar(r);
      }
    } catch (err) {
      console.error(`[login] paso 1 falló después de ${Math.round(performance.now() - t0)} ms`, err);
      setError(getApiErrorMessage(err, "No se pudo iniciar sesión"));
    } finally {
      setEnviando(false);
    }
  }

  async function handleCodigo(e: FormEvent) {
    e.preventDefault();
    if (!desafio) return;
    setError(null);
    setEnviando(true);
    console.info("[login] paso 2: verificando el código", { desafio: desafio.desafio_id });
    try {
      const nueva = await verificarCodigo(desafio.desafio_id, codigo.trim(), email);
      console.info("[login] código correcto: sesión iniciada", { rol: nueva.rol });
      setVerificado(true);
      await new Promise((r) => setTimeout(r, 650)); // deja ver la ola verde de aceptación
      entrar(nueva);
    } catch (err) {
      console.error("[login] paso 2 falló", err);
      setError(getApiErrorMessage(err, "No se pudo verificar el código"));
    } finally {
      setEnviando(false);
    }
  }

  async function handleReenviar() {
    if (!desafio) return;
    setError(null);
    console.info("[login] reenviando código", { desafio: desafio.desafio_id });
    try {
      empezarDesafio(await reenviarCodigo(desafio.desafio_id));
      setAviso("Te mandamos un código nuevo.");
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo reenviar el código"));
    }
  }

  return (
    <div className="pt-safe pb-safe relative flex min-h-screen items-center justify-center overflow-hidden bg-asfalto-900 bg-[radial-gradient(90%_60%_at_50%_0%,rgba(244,180,0,0.14),transparent_70%)] px-4">
      {/* Línea de carril de fondo */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-[repeating-linear-gradient(180deg,rgba(244,180,0,0.18)_0_36px,transparent_36px_72px)]" />
      <div className="relative w-full max-w-sm rounded-[1.75rem] bg-white p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-movii-500 text-movii-900 shadow-[inset_0_-3px_0_rgba(0,0,0,0.15)]">
            {desafio ? (
              <ShieldCheck className="h-6 w-6" strokeWidth={2.2} aria-hidden />
            ) : (
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            )}
          </span>
          <h1 className="font-expandida text-xl font-black text-gray-900">movii</h1>
          <p className="text-center text-sm text-gray-500">
            {desafio ? "Verificá que sos vos" : "Ingresá con tu cuenta de operador o admin"}
          </p>
        </div>

        {!desafio ? (
          <form onSubmit={handlePassword} className="flex flex-col gap-4" noValidate>
            <InputField label="Email" name="email" type="email" autoComplete="off" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <InputField
              label="Contraseña"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" loading={enviando} className="mt-2 w-full">
              Ingresar
            </Button>
            {conGoogle && (
              <a
                href={urlLoginGoogle()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-hormigon-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:border-gray-400 hover:bg-hormigon-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                  <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
                  <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
                </svg>
                Continuar con Google
              </a>
            )}
          </form>
        ) : (
          <form onSubmit={handleCodigo} className="flex flex-col gap-4" noValidate>
            <div className="flex items-start gap-3 rounded-xl bg-[#e8f8ee] p-3 text-sm text-gray-700">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-white" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.4.2.5.3.1.2.1.7-.2 1.2Z" />
                </svg>
              </span>
              <p>
                Te mandamos un código de 6 dígitos por WhatsApp al <strong>{desafio.telefono}</strong>. Vence en{" "}
                {Math.round(desafio.vence_en_segundos / 60)} minutos.
              </p>
            </div>
            {aviso && <Alert variant="success">{aviso}</Alert>}
            <CodigoInput value={codigo} onChange={setCodigo} error={error} ok={verificado} disabled={enviando || verificado} />
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" loading={enviando} className="w-full" disabled={codigo.length !== 6}>
              Verificar e ingresar
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="font-medium text-gray-500 hover:underline"
                onClick={() => {
                  setDesafio(null);
                  setError(null);
                  setAviso(null);
                }}
              >
                ← Volver
              </button>
              <button type="button" className="font-semibold text-movii-600 hover:underline disabled:text-gray-400 disabled:no-underline" disabled={segundos > 0} onClick={() => void handleReenviar()}>
                {segundos > 0 ? `Reenviar código en ${segundos}s` : "Reenviar código"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
