import { useState, type FormEvent } from "react";
import { InputField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { RepartidorSelect } from "./RepartidorSelect";
import { rutaFormSchema } from "./schema";
import type { RutaInput } from "./types";

interface Props {
  valoresIniciales?: RutaInput;
  onSubmit: (input: RutaInput) => Promise<void>;
  enviando: boolean;
  errorServidor: string | null;
  textoBoton?: string;
}

export function RutaForm({ valoresIniciales, onSubmit, enviando, errorServidor, textoBoton = "Crear ruta" }: Props) {
  const [nombre, setNombre] = useState(valoresIniciales?.nombre ?? "");
  const [zona, setZona] = useState(valoresIniciales?.zona ?? "");
  const [fecha, setFecha] = useState(valoresIniciales?.fecha ?? "");
  const [repartidorId, setRepartidorId] = useState(valoresIniciales?.repartidor_id ?? "");
  const [errores, setErrores] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const resultado = rutaFormSchema.safeParse({ nombre, zona, fecha, repartidor_id: repartidorId });
    if (!resultado.success) {
      const nuevosErrores: Record<string, string> = {};
      for (const issue of resultado.error.issues) {
        nuevosErrores[issue.path[0] as string] = issue.message;
      }
      setErrores(nuevosErrores);
      return;
    }
    setErrores({});
    await onSubmit(resultado.data);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {errorServidor && <Alert variant="error">{errorServidor}</Alert>}

      <InputField label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} error={errores.nombre} />
      <InputField label="Zona" value={zona} onChange={(e) => setZona(e.target.value)} error={errores.zona} />
      <InputField
        label="Fecha *"
        type="date"
        required
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        error={errores.fecha}
      />
      <RepartidorSelect value={repartidorId} onChange={setRepartidorId} error={errores.repartidor_id} />

      <div>
        <Button type="submit" loading={enviando}>
          {textoBoton}
        </Button>
      </div>
    </form>
  );
}
