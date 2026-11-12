import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/services/api-client";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { cambiarPasswordPrimerAcceso, reenviarPrimerAcceso, verificarPrimerAcceso } from "@/features/auth/api";
import type { DesafioLogin, PrimerAccesoPendiente } from "@/features/auth/types";
import { CodigoInput } from "@/components/ui/CodigoInput";
import { PASSWORD_MAX, requisitosPassword } from "@/utils/mascaras";

/** Mismas reglas que la API (services.ValidarPassword) más el tope de 72. */
const nuevaPasswordSchema = z
  .object({
    nueva: z
      .string()
      .min(8, "Usá al menos 8 caracteres")
      .max(PASSWORD_MAX, "La contraseña no puede superar los 72 caracteres")
      .regex(/\p{Lu}/u, "Incluí al menos una mayúscula")
      .regex(/\d/, "Incluí al menos un número"),
    repetir: z.string(),
  })
  .refine((v) => v.nueva === v.repetir, { message: "Las contraseñas no coinciden", path: ["repetir"] });

/** Desafío que llega en el fragmento cuando se vuelve de Google con el primer acceso pendiente. */
function desafioDelFragmento(hash: string): (DesafioLogin & { email: string }) | null {
  const d = new URLSearchParams(hash.slice(1));
  const id = d.get("desafio_id");
  if (!id) return null;
  const canal = d.get("canal") === "whatsapp" ? "whatsapp" : "mail";
  return {
    desafio_id: id,
    canal,
    destino: d.get("destino") ?? "",
    telefono: canal === "whatsapp" ? (d.get("destino") ?? "") : "",
    vence_en_segundos: Number(d.get("vence_en_segundos")) || 600,
    email: d.get("email") ?? "",
  };
}

/**
 * Primer acceso (T1): paso 1 elegir contraseña nueva, paso 2 validar el código
 * que llegó por WhatsApp o por mail. Se llega desde el 428 del login (state) o
 * desde la vuelta de Google (fragmento, directo al paso 2).
 */
export function PrimerAccesoPage() {
  const { abrirSesion } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pendiente = location.state as PrimerAccesoPendiente | null;
  const deGoogle = desafioDelFragmento(location.hash);

  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [errores, setErrores] = useState<{ nueva?: string; repetir?: string }>({});
  const [desafio, setDesafio] = useState<DesafioLogin | null>(deGoogle);
  const [codigo, setCodigo] = useState("");
  const [verificado, setVerificado] = useState(false);
  const [segundos, setSegundos] = useState(deGoogle ? 60 : 0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const email = pendiente?.email ?? deGoogle?.email ?? "";

  useEffect(() => {
    if (segundos <= 0) return;
    const t = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundos]);

  if (!pendiente && !deGoogle) return <Navigate to="/login" replace />;

  function empezarDesafio(d: DesafioLogin) {
    setDesafio(d);
    setCodigo("");
    setSegundos(60); // la API acepta un código por minuto
  }

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const r = nuevaPasswordSchema.safeParse({ nueva, repetir });
    if (!r.success) {
      const f = r.error.flatten().fieldErrors;
      setErrores({ nueva: f.nueva?.[0], repetir: f.repetir?.[0] });
      return;
    }
    setErrores({});
    if (!pendiente) return;
    setEnviando(true);
    try {
      empezarDesafio(await cambiarPasswordPrimerAcceso(pendiente.user_id, pendiente.token, nueva));
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo cambiar la contraseña"));
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
      const { token } = await verificarPrimerAcceso(desafio.desafio_id, codigo);
      setVerificado(true);
      await new Promise((r) => setTimeout(r, 650)); // deja ver la ola verde de aceptación
      abrirSesion(token, email);
      navigate("/operaciones", { replace: true });
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
      empezarDesafio(await reenviarPrimerAcceso(desafio.desafio_id));
      setAviso("Te mandamos un código nuevo.");
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo reenviar el código"));
    }
  }

  const canalTexto =
    desafio?.canal === "mail" ? `por mail a ${desafio.destino}` : `por WhatsApp al ${desafio?.destino || desafio?.telefono}`;

  // Checklist en vivo de las reglas de la contraseña (la mayúscula es lo
  // que exige el backend: no se permite menos que ella).
  const req = requisitosPassword(nueva);
  const coinciden = nueva.length > 0 && nueva === repetir;
  const checklist = [
    { ok: req.ochoOMas, texto: "8 caracteres o más" },
    { ok: req.mayuscula, texto: "una mayúscula" },
    { ok: req.numero, texto: "un número" },
    { ok: coinciden, texto: "coinciden" },
  ];

  return (
    <div className="pt-safe pb-safe flex min-h-screen items-center justify-center bg-asfalto-900 bg-[radial-gradient(90%_60%_at_50%_0%,rgba(244,180,0,0.14),transparent_70%)] px-4">
      <div className="w-full max-w-sm rounded-[1.75rem] bg-white p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-movii-500 text-movii-900">
            <KeyRound className="h-6 w-6" strokeWidth={2.2} aria-hidden />
          </span>
          <h1 className="font-expandida text-xl font-black text-gray-900">Primer acceso</h1>
          <p className="text-center text-sm text-gray-500">
            {desafio ? "Verificá que sos vos" : "Elegí una contraseña nueva para tu cuenta"}
          </p>
        </div>

        {!desafio ? (
          <form onSubmit={handlePassword} className="flex flex-col gap-4" noValidate>
            <InputField
              label="Contraseña nueva"
              name="nueva"
              type="password"
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              hint="Al menos 8 caracteres, una mayúscula y un número."
              error={errores.nueva}
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
            />
            <InputField
              label="Repetí la contraseña"
              name="repetir"
              type="password"
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              error={errores.repetir}
              value={repetir}
              onChange={(e) => setRepetir(e.target.value)}
            />
            <ul aria-label="Requisitos de la contraseña" className="flex flex-col gap-1 text-xs">
              {checklist.map((item) => (
                <li key={item.texto} className={item.ok ? "font-semibold text-green-700" : "text-gray-500"}>
                  <span aria-hidden>{item.ok ? "✓ " : "○ "}</span>
                  {item.texto}
                </li>
              ))}
            </ul>
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" loading={enviando} className="mt-2 w-full">
              Guardar y continuar
            </Button>
          </form>
        ) : (
          <form onSubmit={handleCodigo} className="flex flex-col gap-4" noValidate>
            <p className="rounded-xl bg-hormigon-100 p-3 text-sm text-gray-700">
              Te mandamos un código de 6 dígitos <strong>{canalTexto}</strong>. Vence en {Math.round(desafio.vence_en_segundos / 60)} minutos.
            </p>
            {aviso && <Alert variant="success">{aviso}</Alert>}
            <CodigoInput value={codigo} onChange={setCodigo} error={error} ok={verificado} disabled={enviando || verificado} />
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" loading={enviando} className="w-full" disabled={codigo.length !== 6}>
              Verificar e ingresar
            </Button>
            <button
              type="button"
              className="self-end text-xs font-semibold text-movii-600 hover:underline disabled:text-gray-400 disabled:no-underline"
              disabled={segundos > 0}
              onClick={() => void handleReenviar()}
            >
              {segundos > 0 ? `Reenviar código en ${segundos}s` : "Reenviar código"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
