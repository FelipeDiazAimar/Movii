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

export function UsuarioNuevoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>("operador");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setEnviando(true);
    try {
      await registrarUsuario({ nombre, email, password, rol });
      await queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      navigate("/usuarios", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo crear el usuario"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Nuevo usuario</h1>
        <p className="text-sm text-gray-500">Creá una cuenta de operador, supervisor o repartidor.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <InputField label="Nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <InputField
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <InputField
            label="Contraseña"
            type="password"
            required
            hint="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
