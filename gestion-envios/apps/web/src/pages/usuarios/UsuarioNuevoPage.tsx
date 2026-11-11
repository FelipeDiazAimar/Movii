import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { registrarUsuario } from "@/features/auth/api";
import { ROLES, type Rol } from "@/features/auth/types";
import { getApiErrorMessage } from "@/services/api-client";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { InputField, SelectField } from "@/components/ui/Field";
import { PageHeader, PAGE_NARROW } from "@/components/ui/PageHeader";
import {
  PASSWORD_MAX,
  TELEFONO_ERROR,
  colapsarEspacios,
  formatearTelefonoAR,
  limpiarEmailAlEscribir,
  limpiarNombrePersonaAlEscribir,
  limpiarTelefonoAlEscribir,
  normalizarTelefonoAR,
  validarEmail,
  validarPassword,
} from "@/utils/mascaras";

import { UserPlus } from "lucide-react";

type CampoUsuario = "nombre" | "email" | "password" | "telefono";
type ErroresUsuario = Partial<Record<CampoUsuario, string>>;

/** Validación propia (H34b): mensajes en español junto a cada campo, no los del navegador. */
function validarUsuario(v: { nombre: string; email: string; password: string; telefono: string }): ErroresUsuario {
  const e: ErroresUsuario = {};
  const nombre = colapsarEspacios(v.nombre);
  if (!nombre) e.nombre = "Ingresá el nombre.";
  else if (nombre.length > 100) e.nombre = "El nombre no puede superar los 100 caracteres.";
  const email = v.email.trim();
  if (!email) e.email = "Ingresá el email.";
  else {
    const invalido = validarEmail(email);
    if (invalido) e.email = invalido;
  }
  // Mismas reglas que el backend (ValidarPassword): 8+, 72 bytes máx.,
  // una mayúscula y un número.
  const passwordInvalida = validarPassword(v.password);
  if (passwordInvalida) e.password = passwordInvalida;
  const telefono = v.telefono.trim();
  if (telefono && normalizarTelefonoAR(telefono) === null) e.telefono = TELEFONO_ERROR;
  return e;
}

export function UsuarioNuevoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>("operador");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<ErroresUsuario>({});
  const [intentado, setIntentado] = useState(false);

  // Después del primer intento, cada campo se revalida al cambiar.
  function cambiar(campo: CampoUsuario, valor: string, set: (v: string) => void) {
    set(valor);
    if (intentado) setErrores(validarUsuario({ nombre, email, password, telefono, [campo]: valor }));
  }
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIntentado(true);

    const nuevos = validarUsuario({ nombre, email, password, telefono });
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setEnviando(true);
    try {
      const tel = telefono.trim();
      await registrarUsuario({
        nombre: colapsarEspacios(nombre),
        email: email.trim(),
        password,
        rol,
        telefono: tel ? formatearTelefonoAR(tel) : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      navigate("/usuarios", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo crear el usuario"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={PAGE_NARROW}>
      <PageHeader title="Nuevo usuario" icon={UserPlus} description="Creá una cuenta de operador, admin o repartidor." />

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <InputField
            label="Nombre"
            name="nombre"
            required
            maxLength={100}
            autoComplete="off"
            value={nombre}
            error={errores.nombre}
            onChange={(e) => cambiar("nombre", limpiarNombrePersonaAlEscribir(e.target.value), setNombre)}
            onBlur={() => setNombre((n) => colapsarEspacios(n))}
          />
          <InputField
            label="Email"
            name="email"
            type="email"
            inputMode="email"
            required
            maxLength={150}
            autoComplete="off"
            value={email}
            error={errores.email}
            onChange={(e) => cambiar("email", limpiarEmailAlEscribir(e.target.value), setEmail)}
          />
          <InputField
            label="Contraseña"
            name="password"
            type="password"
            required
            maxLength={PASSWORD_MAX}
            autoComplete="new-password"
            hint="Mínimo 8 caracteres, una mayúscula y un número"
            value={password}
            error={errores.password}
            onChange={(e) => cambiar("password", e.target.value, setPassword)}
          />
          <InputField
            label="Celular (opcional)"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            placeholder="3564 41-2345"
            hint="Para entrar con código por WhatsApp y, si es repartidor, recibir el aviso de sus rutas."
            name="telefono"
            value={telefono}
            error={errores.telefono}
            onChange={(e) => cambiar("telefono", limpiarTelefonoAlEscribir(e.target.value), setTelefono)}
            onBlur={() => setTelefono((t) => formatearTelefonoAR(t))}
          />
          <SelectField label="Rol" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </SelectField>

          {error && <Alert variant="error">{error}</Alert>}

          <Button type="submit" loading={enviando}>
            Crear usuario
          </Button>
        </form>
      </Card>
    </div>
  );
}
