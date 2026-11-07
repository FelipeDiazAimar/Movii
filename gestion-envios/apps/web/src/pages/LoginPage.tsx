import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/services/api-client";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { reenviarCodigo } from "@/features/auth/api";
import type { DesafioLogin, Sesion } from "@/features/auth/types";

export function LoginPage() {
  const { sesion, login, verificarCodigo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Credenciales del supervisor de la demo (migrations/0002_seed.up.sql)
  // precargadas, igual que en la app móvil. autoComplete="off" evita que el
  // navegador pise la contraseña con una vieja guardada.
  const [email, setEmail] = useState("supervisor@movii.demo");
  const [password, setPassword] = useState("Movii2026!");

  // Segundo paso (HU-16): código de 6 dígitos que llega por WhatsApp.
  const [desafio, setDesafio] = useState<DesafioLogin | null>(null);
  const [codigo, setCodigo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

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
    setSegundos(30); // espera antes de poder pedir otro código
  }

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r = await login({ email, password });
      if ("desafio_id" in r) empezarDesafio(r);
      else entrar(r);
    } catch (err) {
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
    try {
      entrar(await verificarCodigo(desafio.desafio_id, codigo.trim(), email));
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo verificar el código"));
    } finally {
      setEnviando(false);
    }
  }

  async function handleReenviar() {
    if (!desafio) return;
    setError(null);
    try {
      empezarDesafio(await reenviarCodigo(desafio.desafio_id));
      setAviso("Te mandamos un código nuevo.");
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo reenviar el código"));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-movii-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-movii-500 text-lg font-bold text-movii-900">M</span>
          <h1 className="text-lg font-semibold text-gray-900">Movii — Panel de operaciones</h1>
          <p className="text-center text-sm text-gray-500">
            {desafio ? "Verificá que sos vos" : "Ingresá con tu cuenta de operador o supervisor"}
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
                Te mandamos un código de 6 dígitos por WhatsApp al <strong>{desafio.telefono}</strong>. Vence en 5 minutos.
              </p>
            </div>
            {aviso && <Alert variant="success">{aviso}</Alert>}
            <InputField
              label="Código de verificación"
              name="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-xl tracking-[0.6em]"
            />
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
