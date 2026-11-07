import { Children, forwardRef, Fragment, isValidElement, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { DatePicker } from "./DatePicker";
import { Select, type Opcion } from "./Select";

interface FieldWrapperProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FieldWrapper({ label, htmlFor, error, hint, children }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const inputBaseClass =
  "rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-movii-400 disabled:bg-gray-100 disabled:text-gray-500";

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  { label, error, hint, id, className = "", ...props },
  ref,
) {
  const fieldId = id ?? props.name ?? label;
  return (
    <FieldWrapper label={label} htmlFor={fieldId} error={error} hint={hint}>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={Boolean(error)}
        className={`${inputBaseClass} ${error ? "border-red-400" : "border-gray-300"} ${className}`}
        {...props}
      />
    </FieldWrapper>
  );
});

interface SelectFieldProps {
  label: string;
  name?: string;
  id?: string;
  value: string;
  /** Mantiene la forma de un <select>: el valor nuevo llega en `e.target.value`. */
  onChange?: (e: { target: { value: string; name: string } }) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  /** Las opciones se declaran como <option value="x">Texto</option>. */
  children?: ReactNode;
}

function textoPlano(n: ReactNode): string {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textoPlano).join("");
  if (isValidElement<{ children?: ReactNode }>(n)) return textoPlano(n.props.children);
  return "";
}

export function opcionesDe(children: ReactNode): Opcion[] {
  const out: Opcion[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement<{ value?: string; disabled?: boolean; children?: ReactNode }>(c)) return;
    if (c.type === Fragment) {
      out.push(...opcionesDe(c.props.children));
      return;
    }
    const texto = textoPlano(c.props.children);
    out.push({ value: String(c.props.value ?? texto), label: texto, texto, disabled: c.props.disabled });
  });
  return out;
}

/** Campo con lista desplegable propia (ver Select); se usa igual que un <select>. */
export function SelectField({ label, id, name, value, onChange, disabled, error, hint, placeholder, children }: SelectFieldProps) {
  const auto = useId();
  const fieldId = id ?? name ?? auto;
  const opciones = opcionesDe(children);
  // Una opción con valor "" es el "Seleccionar…": se muestra como texto de relleno, no como elegible.
  const vacia = opciones.find((o) => o.value === "");
  return (
    <FieldWrapper label={label} htmlFor={fieldId} error={error} hint={hint}>
      <Select
        id={fieldId}
        value={value}
        disabled={disabled}
        invalido={Boolean(error)}
        placeholder={placeholder ?? (vacia ? String(vacia.label) : undefined)}
        opciones={opciones}
        onChange={(v) => onChange?.({ target: { value: v, name: name ?? "" } })}
      />
    </FieldWrapper>
  );
}

interface DateFieldProps {
  label: string;
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  limpiable?: boolean;
}

/** Campo de fecha con calendario propio (ver DatePicker). El valor es YYYY-MM-DD. */
export function DateField({ label, id, name, value, onChange, error, hint, disabled, min, max, limpiable }: DateFieldProps) {
  const auto = useId();
  const fieldId = id ?? name ?? auto;
  return (
    <FieldWrapper label={label} htmlFor={fieldId} error={error} hint={hint}>
      <DatePicker id={fieldId} value={value} onChange={onChange} invalido={Boolean(error)} disabled={disabled} min={min} max={max} limpiable={limpiable} />
    </FieldWrapper>
  );
}
