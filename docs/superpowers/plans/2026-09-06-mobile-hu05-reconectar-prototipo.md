# Móvil — Reconectar el prototipo a la API real (HU-05) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover el prototipo móvil a `gestion-envios/apps/mobile/` y reconectar el login y la pantalla "Mi ruta de hoy" a la API real (`POST /auth/login`, `GET /repartidor/envios-del-dia`), manteniendo el resto del prototipo (confirmar entrega, incidencia, reprogramar, tracking) como maqueta estática — son HU de Sprint 2/3, fuera de alcance.

**Architecture:** El prototipo (Expo Router + NativeWind, ya armado con manus.ai) se conserva tal cual en su diseño visual. Se agrega una capa `lib/api-client.ts` (axios + `expo-secure-store` para el JWT) y se adapta la respuesta de `GET /repartidor/envios-del-dia` al tipo `Shipment` que ya usan los componentes existentes (`StopCard`, etc.), para no tocar la UI. El backend (Go) ya expone ambos endpoints (planes de HU-01 y HU-05) y ya escucha en todas las interfaces (`http.ListenAndServe(":"+puerto, ...)`), así que es alcanzable desde el teléfono por la IP de red local de la PC.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript, axios (ya instalado), expo-secure-store (ya instalado), vitest (ya configurado) para las funciones puras.

**Spec:** [docs/superpowers/specs/2026-09-05-sprint1-movii-design.md](../specs/2026-09-05-sprint1-movii-design.md)

## Global Constraints

- El prototipo pasa de `movii/` (raíz del repo) a `gestion-envios/apps/mobile/`.
- Backend ya disponible en este mismo repo: `gestion-envios/services/api` (Go), con `POST /auth/login` y `GET /repartidor/envios-del-dia` (protegido, rol `repartidor`).
- Usuario de demo para probar: `repartidor@movii.demo` / `Movii2026!` (seed de HU-01).
- La IP de red local de la PC de desarrollo en este momento es `192.168.0.207` (Wi-Fi) — puede cambiar si se reconecta a otra red; usar `ipconfig` (Windows) para confirmarla si el teléfono no puede conectar.
- No se toca ninguna pantalla más allá de login y "Mi ruta de hoy" — el resto del prototipo (confirmar entrega, incidencia, reprogramar, tracking, mapa) sigue siendo maqueta estática con datos mock, sin llamadas reales.
- Commits en español, cierran con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- No usar Docker. No instalar dependencias nuevas de npm salvo que un paso lo indique explícitamente (axios y expo-secure-store ya están).

---

## Task 0: Instalar pnpm y mover el proyecto a `gestion-envios/apps/mobile/`

Tarea de configuración, sin ciclo TDD (son comandos y una verificación de compilación).

**Files:**
- Move: `movii/` → `gestion-envios/apps/mobile/` (todo el contenido, vía `git mv`)
- Create: `gestion-envios/pnpm-workspace.yaml`

- [ ] **Paso 1: Habilitar pnpm vía corepack**

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm --version
```

Expected: imprime `9.12.0`.

- [ ] **Paso 2: Mover el proyecto con git mv (preserva historial)**

Desde la raíz del repo (`Movii/`):

```bash
mkdir -p gestion-envios/apps
git mv movii gestion-envios/apps/mobile
```

- [ ] **Paso 3: Crear el workspace de pnpm a nivel de `gestion-envios/`**

`gestion-envios/pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Paso 4: Reinstalar dependencias desde la nueva ubicación**

```bash
cd gestion-envios/apps/mobile
pnpm install
```

Expected: instala sin errores (usa el `pnpm-lock.yaml` existente).

- [ ] **Paso 5: Verificar que el proyecto sigue compilando/tipando bien tras el move**

```bash
pnpm check
```

Expected: `tsc --noEmit` sin errores (los alias `@/...` se resuelven por `tsconfig.json`, que usa rutas relativas a su propia carpeta — mover la carpeta entera no rompe los alias internos).

- [ ] **Paso 6: Commit**

```bash
cd "gestion-envios/apps/mobile"
git add -A
cd ../../..
git add gestion-envios/pnpm-workspace.yaml
git commit -m "chore: mover el prototipo movil a gestion-envios/apps/mobile

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 1: Cliente de API — login, JWT, almacenamiento del token

**Files:**
- Create: `gestion-envios/apps/mobile/lib/api-client.ts`
- Create: `gestion-envios/apps/mobile/tests/api-client.test.ts`
- Create: `gestion-envios/apps/mobile/.env.example`
- Modify: `gestion-envios/apps/mobile/.gitignore` (agregar `.env`)

**Interfaces:**
- Produces:
  ```ts
  export type ClaimsJWT = { sub: string; rol: string; exp: number };
  export function decodeJwt(token: string): ClaimsJWT;

  export async function saveToken(token: string): Promise<void>;
  export async function getToken(): Promise<string | null>;
  export async function clearToken(): Promise<void>;

  export type LoginResponse = { token: string };
  export async function login(email: string, password: string): Promise<ClaimsJWT & { token: string }>;
  ```

- [ ] **Paso 1: Escribir el test de `decodeJwt` (falla)**

`tests/api-client.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { decodeJwt } from "@/lib/api-client";

// Token de ejemplo con claims {"sub":"user-1","rol":"repartidor","exp":9999999999}
// (firma inventada, decodeJwt no valida la firma — solo lee el payload,
// igual que hace cualquier cliente que confía en HTTPS/el servidor emisor).
const TOKEN_DE_PRUEBA =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJyb2wiOiJyZXBhcnRpZG9yIiwiZXhwIjo5OTk5OTk5OTk5fQ.firma-invalida-no-verificada";

describe("decodeJwt", () => {
  it("lee sub, rol y exp del payload sin validar la firma", () => {
    const claims = decodeJwt(TOKEN_DE_PRUEBA);
    expect(claims.sub).toBe("user-1");
    expect(claims.rol).toBe("repartidor");
    expect(claims.exp).toBe(9999999999);
  });

  it("lanza un error con un token mal formado", () => {
    expect(() => decodeJwt("no-es-un-jwt")).toThrow();
  });
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
cd gestion-envios/apps/mobile
pnpm vitest run tests/api-client.test.ts
```

Expected: FAIL (`@/lib/api-client` no existe).

- [ ] **Paso 3: Implementar `lib/api-client.ts`**

```ts
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

const TOKEN_KEY = "movii_jwt_token";

export const api = axios.create({ baseURL: API_URL, timeout: 10000 });

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Claims mínimas que la API pone en el JWT (ver movii/api internal/services/auth_service.go). */
export type ClaimsJWT = {
  sub: string;
  rol: string;
  exp: number;
};

/**
 * decodeJwt lee el payload de un JWT sin validar la firma — la app confía
 * en el servidor que lo emitió (vía HTTPS/la misma red); esto es solo para
 * leer sub/rol/exp y decidir qué mostrar en la UI, no para autorizar nada
 * por sí solo (eso lo hace la API en cada request).
 */
export function decodeJwt(token: string): ClaimsJWT {
  const partes = token.split(".");
  if (partes.length !== 3) {
    throw new Error("decodeJwt: el token no tiene el formato de un JWT (header.payload.signature)");
  }
  const payloadBase64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
  const payloadJson = Buffer.from(payloadBase64, "base64").toString("utf-8");
  return JSON.parse(payloadJson) as ClaimsJWT;
}

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return window.localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/**
 * login llama a POST /auth/login, guarda el token y devuelve las claims
 * decodificadas junto con el token crudo.
 */
export async function login(email: string, password: string): Promise<ClaimsJWT & { token: string }> {
  const { data } = await api.post<{ token: string }>("/auth/login", { email, password });
  await saveToken(data.token);
  const claims = decodeJwt(data.token);
  return { ...claims, token: data.token };
}

export async function logout(): Promise<void> {
  await clearToken();
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

```bash
pnpm vitest run tests/api-client.test.ts
```

Expected: PASS (2 tests).

- [ ] **Paso 5: Crear `.env.example` y ajustar `.gitignore`**

`gestion-envios/apps/mobile/.env.example`:

```
# IP de red local de la PC que corre la API (no localhost: el teléfono la
# necesita para llegar por WiFi). Confirmar con `ipconfig` (Windows) si
# cambia de red.
EXPO_PUBLIC_API_URL=http://192.168.0.207:8080
```

Agregar a `gestion-envios/apps/mobile/.gitignore` (ya tiene `.env*.local`, agregar la línea para el `.env` real):

```
.env
```

Crear también el `.env` real (no commiteado) con el mismo contenido que `.env.example`, para usarlo en el Paso 6 de la Task 5.

- [ ] **Paso 6: Commit**

```bash
cd gestion-envios/apps/mobile
git add lib/api-client.ts tests/api-client.test.ts .env.example .gitignore
git commit -m "feat: agregar cliente de API con login, JWT y almacenamiento seguro del token

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Traer y adaptar los envíos del día (HU-05)

**Files:**
- Modify: `gestion-envios/apps/mobile/lib/api-client.ts`
- Create: `gestion-envios/apps/mobile/tests/adaptar-envios-del-dia.test.ts`

**Interfaces:**
- Consumes: `api` (axios instance, Task 1), tipos `Shipment`/`ShipmentStatus` (ya existen en `types/logistics.ts`).
- Produces:
  ```ts
  // Formas del JSON que devuelve GET /repartidor/envios-del-dia (ver
  // domain.ResumenDelDia / EnvioDelDia / RutaConEnviosDelDia en el backend Go).
  export type EnvioDelDiaAPI = {
    id: string; codigo_guia: string; estado: string; peso: number; tamano: string;
    tipo_contenido: string; fragil: boolean; urgente: boolean; ruta_id: string | null;
    ruta_nombre: string;
    destinatario: { id: string; nombre: string; telefono: string; calle: string; numero: string; piso_depto: string; localidad: string; codigo_postal: string };
  };
  export type RutaConEnviosAPI = { ruta_id: string; ruta_nombre: string; envios: EnvioDelDiaAPI[] };
  export type ResumenDelDiaAPI = {
    fecha: string; rutas: RutaConEnviosAPI[];
    total: number; pendientes: number; asignados: number; en_camino: number; entregados: number; no_entregados: number;
  };

  export function mapEnvioDelDiaToShipment(envio: EnvioDelDiaAPI, driverId: string, stopOrder: number): Shipment;
  export async function getEnviosDelDia(estado?: string): Promise<ResumenDelDiaAPI>;
  ```

- [ ] **Paso 1: Escribir el test del adaptador (falla)**

`tests/adaptar-envios-del-dia.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { mapEnvioDelDiaToShipment, type EnvioDelDiaAPI } from "@/lib/api-client";

const envioDeEjemplo: EnvioDelDiaAPI = {
  id: "envio-1",
  codigo_guia: "MOV-20260906-0001",
  estado: "asignado",
  peso: 4.2,
  tamano: "mediano",
  tipo_contenido: "Electrónica",
  fragil: true,
  urgente: false,
  ruta_id: "ruta-1",
  ruta_nombre: "Ruta Centro 01",
  destinatario: {
    id: "dest-1", nombre: "Juan Pérez", telefono: "3564-000000",
    calle: "San Martín", numero: "450", piso_depto: "", localidad: "San Francisco", codigo_postal: "X2400",
  },
};

describe("mapEnvioDelDiaToShipment", () => {
  it("mapea los campos del envío real a la forma Shipment del prototipo", () => {
    const shipment = mapEnvioDelDiaToShipment(envioDeEjemplo, "drv-real", 3);

    expect(shipment.id).toBe("envio-1");
    expect(shipment.code).toBe("MOV-20260906-0001");
    expect(shipment.recipient.name).toBe("Juan Pérez");
    expect(shipment.recipient.address).toBe("San Martín 450");
    expect(shipment.recipient.locality).toBe("San Francisco");
    expect(shipment.driverId).toBe("drv-real");
    expect(shipment.routeName).toBe("Ruta Centro 01");
    expect(shipment.stopOrder).toBe(3);
    expect(shipment.weight).toBe("4.2 kg");
    expect(shipment.fragile).toBe(true);
  });

  it("mapea el estado 'asignado' del backend a 'pendiente' en el prototipo (no existe un estado visual propio para 'asignado' todavía)", () => {
    const shipment = mapEnvioDelDiaToShipment(envioDeEjemplo, "drv-real", 1);
    expect(shipment.status).toBe("pendiente");
  });

  it("respeta los estados que sí coinciden 1 a 1 (en_camino, entregado, no_entregado)", () => {
    for (const estado of ["en_camino", "entregado", "no_entregado"] as const) {
      const shipment = mapEnvioDelDiaToShipment({ ...envioDeEjemplo, estado }, "drv-real", 1);
      expect(shipment.status).toBe(estado);
    }
  });
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
pnpm vitest run tests/adaptar-envios-del-dia.test.ts
```

Expected: FAIL (`mapEnvioDelDiaToShipment`, `EnvioDelDiaAPI` no existen).

- [ ] **Paso 3: Implementar el adaptador y `getEnviosDelDia`**

Agregar a `lib/api-client.ts` (al final del archivo):

```ts
import type { Shipment, ShipmentStatus } from "@/types/logistics";

export type EnvioDelDiaAPI = {
  id: string;
  codigo_guia: string;
  estado: string;
  peso: number;
  tamano: string;
  tipo_contenido: string;
  fragil: boolean;
  urgente: boolean;
  ruta_id: string | null;
  ruta_nombre: string;
  destinatario: {
    id: string;
    nombre: string;
    telefono: string;
    calle: string;
    numero: string;
    piso_depto: string;
    localidad: string;
    codigo_postal: string;
  };
};

export type RutaConEnviosAPI = {
  ruta_id: string;
  ruta_nombre: string;
  envios: EnvioDelDiaAPI[];
};

export type ResumenDelDiaAPI = {
  fecha: string;
  rutas: RutaConEnviosAPI[];
  total: number;
  pendientes: number;
  asignados: number;
  en_camino: number;
  entregados: number;
  no_entregados: number;
};

/**
 * mapEnvioDelDiaToShipment adapta un envío real de la API a la forma
 * Shipment que ya usan los componentes del prototipo (StopCard, etc.), para
 * no tener que rediseñar la UI. El backend todavía no tiene un estado
 * "asignado" en el vocabulario visual del prototipo, así que se muestra
 * como "pendiente" (semánticamente el más cercano: ya tiene ruta pero
 * todavía no salió a repartir).
 */
export function mapEnvioDelDiaToShipment(envio: EnvioDelDiaAPI, driverId: string, stopOrder: number): Shipment {
  const status: ShipmentStatus = envio.estado === "asignado" ? "pendiente" : (envio.estado as ShipmentStatus);

  return {
    id: envio.id,
    code: envio.codigo_guia,
    recipient: {
      name: envio.destinatario.nombre,
      address: `${envio.destinatario.calle} ${envio.destinatario.numero}`.trim(),
      locality: envio.destinatario.localidad,
      postalCode: envio.destinatario.codigo_postal,
      phone: envio.destinatario.telefono,
    },
    sender: "",
    zone: "Centro",
    driverId,
    routeName: envio.ruta_nombre,
    stopOrder,
    timeWindow: "",
    estimatedDate: "Hoy",
    status,
    packageDescription: envio.tipo_contenido || "Paquete",
    weight: `${envio.peso} kg`,
    fragile: envio.fragil,
    timeline: [],
  };
}

/** getEnviosDelDia llama a GET /repartidor/envios-del-dia?estado=. */
export async function getEnviosDelDia(estado?: string): Promise<ResumenDelDiaAPI> {
  const { data } = await api.get<ResumenDelDiaAPI>("/repartidor/envios-del-dia", {
    params: estado ? { estado } : undefined,
  });
  return data;
}
```

**Nota:** mover el `import type { Shipment, ShipmentStatus } from "@/types/logistics";` al bloque de imports del inicio del archivo (junto a los de `axios`/`expo-secure-store`/`react-native`), no dejarlo a mitad de archivo — TypeScript lo permite pero no es el estilo del resto del proyecto.

- [ ] **Paso 4: Correr el test y verificar que pasa**

```bash
pnpm vitest run tests/adaptar-envios-del-dia.test.ts
```

Expected: PASS (3 tests).

- [ ] **Paso 5: Commit**

```bash
cd gestion-envios/apps/mobile
pnpm check
git add lib/api-client.ts tests/adaptar-envios-del-dia.test.ts
git commit -m "feat: agregar getEnviosDelDia y adaptador a la forma Shipment del prototipo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Reconectar `MoviiProvider` (login real + carga de envíos)

**Files:**
- Modify: `gestion-envios/apps/mobile/lib/movii-context.tsx`

**Interfaces:**
- Consumes: `login`, `logout`, `getToken`, `decodeJwt`, `getEnviosDelDia`, `mapEnvioDelDiaToShipment` (Tasks 1-2).
- Produces (reemplaza la forma actual de `MoviiContextValue`):
  ```ts
  type MoviiContextValue = {
    role: "repartidor" | "operador" | null;
    driverName: string;
    shipments: Shipment[];      // datos MOCK, sin tocar — siguen alimentando el resto del prototipo
    enviosDelDia: Shipment[];   // datos REALES de HU-05, mapeados
    resumenDelDia: ResumenDelDiaAPI | null;
    cargandoEnviosDelDia: boolean;
    errorEnviosDelDia: string | null;
    activeDriverId: string;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    recargarEnviosDelDia: () => Promise<void>;
    findShipment: (idOrCode: string) => Shipment | undefined; // ahora busca en shipments Y en enviosDelDia
    updateShipment: (id: string, patch: Partial<Shipment>) => void;
    setShipmentStatus: (id: string, status: ShipmentStatus, extra?: Partial<Shipment>) => void;
  };
  ```
  `login` ahora es async, recibe email/contraseña (no un rol de mentira), y dispara la carga de `enviosDelDia` automáticamente si el rol es `repartidor`.

Esta tarea no tiene test automatizado propio (es la integración de piezas ya testeadas en Tasks 1-2 dentro de un React Context, que se verifica manualmente en la Task 5) — seguir los pasos con cuidado y compilar después de cada uno.

- [ ] **Paso 1: Reescribir `lib/movii-context.tsx`**

```tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { allSeedShipments, drivers } from "@/mock/shipments";
import type { Shipment, ShipmentStatus } from "@/types/logistics";
import {
  login as apiLogin,
  logout as apiLogout,
  getEnviosDelDia,
  mapEnvioDelDiaToShipment,
  type ResumenDelDiaAPI,
} from "@/lib/api-client";

type PrototypeRole = "repartidor" | "operador" | null;

type MoviiContextValue = {
  role: PrototypeRole;
  driverName: string;
  shipments: Shipment[];
  enviosDelDia: Shipment[];
  resumenDelDia: ResumenDelDiaAPI | null;
  cargandoEnviosDelDia: boolean;
  errorEnviosDelDia: string | null;
  activeDriverId: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  recargarEnviosDelDia: () => Promise<void>;
  findShipment: (idOrCode: string) => Shipment | undefined;
  updateShipment: (id: string, patch: Partial<Shipment>) => void;
  setShipmentStatus: (id: string, status: ShipmentStatus, extra?: Partial<Shipment>) => void;
};

const MoviiContext = createContext<MoviiContextValue | undefined>(undefined);

const DRIVER_ID_REAL = "drv-real";

export function MoviiProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<PrototypeRole>(null);
  const [driverName, setDriverName] = useState("");
  const [shipments, setShipments] = useState<Shipment[]>(allSeedShipments);
  const [enviosDelDia, setEnviosDelDia] = useState<Shipment[]>([]);
  const [resumenDelDia, setResumenDelDia] = useState<ResumenDelDiaAPI | null>(null);
  const [cargandoEnviosDelDia, setCargandoEnviosDelDia] = useState(false);
  const [errorEnviosDelDia, setErrorEnviosDelDia] = useState<string | null>(null);
  const activeDriverId = drivers[0].id;

  const recargarEnviosDelDia = async () => {
    setCargandoEnviosDelDia(true);
    setErrorEnviosDelDia(null);
    try {
      const resumen = await getEnviosDelDia();
      setResumenDelDia(resumen);
      const mapeados = resumen.rutas.flatMap((ruta) =>
        ruta.envios.map((envio, indice) => mapEnvioDelDiaToShipment(envio, DRIVER_ID_REAL, indice + 1)),
      );
      setEnviosDelDia(mapeados);
    } catch (err) {
      setErrorEnviosDelDia("No se pudo cargar la ruta del día. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setCargandoEnviosDelDia(false);
    }
  };

  const login = async (email: string, password: string) => {
    const claims = await apiLogin(email, password);
    const rolValido: PrototypeRole = claims.rol === "repartidor" || claims.rol === "operador" ? claims.rol : null;
    setRole(rolValido);
    setDriverName(email.split("@")[0]);

    if (rolValido === "repartidor") {
      await recargarEnviosDelDia();
    }
  };

  const logout = async () => {
    await apiLogout();
    setRole(null);
    setDriverName("");
    setEnviosDelDia([]);
    setResumenDelDia(null);
  };

  const updateShipment = (id: string, patch: Partial<Shipment>) => {
    setShipments((current) => current.map((shipment) => (shipment.id === id ? { ...shipment, ...patch } : shipment)));
  };

  const setShipmentStatus = (id: string, status: ShipmentStatus, extra: Partial<Shipment> = {}) => {
    setShipments((current) =>
      current.map((shipment) => {
        if (shipment.id !== id) return shipment;
        const completedStages = status === "pendiente" ? 2 : status === "en_camino" ? 3 : 4;
        const nextTimeline = shipment.timeline.map((entry, index) => ({
          ...entry,
          completed: index < completedStages,
          timestamp: index === completedStages - 1 ? "Hoy · ahora" : entry.timestamp,
        }));
        return { ...shipment, ...extra, status, timeline: nextTimeline };
      }),
    );
  };

  const value = useMemo<MoviiContextValue>(
    () => ({
      role,
      driverName,
      shipments,
      enviosDelDia,
      resumenDelDia,
      cargandoEnviosDelDia,
      errorEnviosDelDia,
      activeDriverId,
      login,
      logout,
      recargarEnviosDelDia,
      findShipment: (idOrCode) =>
        shipments.find((shipment) => shipment.id === idOrCode || shipment.code.toLowerCase() === idOrCode.toLowerCase()) ??
        enviosDelDia.find((shipment) => shipment.id === idOrCode || shipment.code.toLowerCase() === idOrCode.toLowerCase()),
      updateShipment,
      setShipmentStatus,
    }),
    [role, driverName, shipments, enviosDelDia, resumenDelDia, cargandoEnviosDelDia, errorEnviosDelDia],
  );

  return <MoviiContext.Provider value={value}>{children}</MoviiContext.Provider>;
}

export function useMovii() {
  const context = useContext(MoviiContext);
  if (!context) throw new Error("useMovii debe utilizarse dentro de MoviiProvider");
  return context;
}
```

- [ ] **Paso 2: Compilar**

```bash
pnpm check
```

Expected: sin errores de tipos. Si `login`/`logout` de `@/lib/api-client` chocan de nombre con las funciones locales `login`/`logout` del provider, ya están importadas como `apiLogin`/`apiLogout` arriba — verificar que no quede ninguna referencia suelta al nombre corto.

- [ ] **Paso 3: Commit**

```bash
cd gestion-envios/apps/mobile
git add lib/movii-context.tsx
git commit -m "feat: reconectar MoviiProvider con login real y carga de envios del dia

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Pantalla de login — llamar a la API real

**Files:**
- Modify: `gestion-envios/apps/mobile/app/login.tsx`

**Interfaces:**
- Consumes: `useMovii().login` (ahora async, Task 3).

- [ ] **Paso 1: Ajustar `LoginScreen`**

Reemplazar el estado inicial y el handler `enterDemo` de `app/login.tsx`:

```tsx
const [email, setEmail] = useState("repartidor@movii.demo");
const [password, setPassword] = useState("Movii2026!");
const [keepSignedIn, setKeepSignedIn] = useState(true);
const [cargando, setCargando] = useState(false);
const [error, setError] = useState<string | null>(null);
const { login } = useMovii();

const enterDemo = async () => {
  setError(null);
  setCargando(true);
  try {
    await login(email, password);
    router.replace("/(tabs)");
  } catch (err) {
    setError("No se pudo iniciar sesión. Verificá el email y la contraseña.");
  } finally {
    setCargando(false);
  }
};
```

Cambiar el botón de ingresar para reflejar el estado de carga y mostrar el error:

```tsx
<PrimaryButton label={cargando ? "Ingresando…" : "Ingresar"} onPress={enterDemo} icon="→" disabled={cargando} />
{error ? <Text style={styles.errorText}>{error}</Text> : null}
```

Agregar el estilo `errorText` al `StyleSheet.create` existente:

```ts
errorText: { color: "#D70015", fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: -6 },
```

**Nota:** revisar la firma real de `PrimaryButton` en `components/ui/movii-ui.tsx` antes de agregar la prop `disabled` — si el componente no la soporta todavía, agregarla ahí (deshabilitar el `Pressable` y bajar la opacidad cuando `disabled` es `true`) en vez de ignorarla silenciosamente.

- [ ] **Paso 2: Compilar**

```bash
cd gestion-envios/apps/mobile
pnpm check
```

Expected: sin errores.

- [ ] **Paso 3: Commit**

```bash
git add app/login.tsx components/ui/movii-ui.tsx
git commit -m "feat: conectar la pantalla de login a la autenticacion real

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Pantalla "Mi ruta de hoy" con datos reales + verificación en el teléfono

**Files:**
- Modify: `gestion-envios/apps/mobile/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `useMovii().enviosDelDia`, `resumenDelDia`, `cargandoEnviosDelDia`, `errorEnviosDelDia`, `recargarEnviosDelDia` (Task 3).

- [ ] **Paso 1: Ajustar `RouteScreen`**

Reemplazar la derivación de `stops`/`progress`/`inProgress` (que hoy filtra el array mock con un hack de comparación de códigos) por los datos reales, y agregar pull-to-refresh:

```tsx
import { useMemo } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AuroraBackground } from "@/components/aurora-background";
import { GlassCard, IconAction, SectionHeading } from "@/components/ui/movii-ui";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDriver } from "@/mock/shipments";
import { useMovii } from "@/lib/movii-context";
import { type Shipment } from "@/types/logistics";

function StopCard({ shipment, onPress }: { shipment: Shipment; onPress: () => void }) {
  const meta = `${shipment.recipient.address} · ${shipment.recipient.locality}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ver parada ${shipment.stopOrder}, ${shipment.recipient.name}`} onPress={onPress} style={({ pressed }) => [styles.stopCard, pressed && styles.pressed]}>
      <View style={styles.stopNumber}><Text style={styles.stopNumberText}>{shipment.stopOrder}</Text></View>
      <View style={styles.stopMain}>
        <View style={styles.stopHeadline}><Text numberOfLines={1} style={styles.stopName}>{shipment.recipient.name}</Text><Text style={styles.stopWindow}>{shipment.timeWindow}</Text></View>
        <Text numberOfLines={1} style={styles.stopAddress}>{meta}</Text>
        <View style={styles.stopFooter}><StatusBadge status={shipment.status} /><Text style={styles.stopCode}>{shipment.code.slice(-6)}</Text></View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function RouteScreen() {
  const { enviosDelDia, resumenDelDia, cargandoEnviosDelDia, errorEnviosDelDia, recargarEnviosDelDia, activeDriverId } = useMovii();
  const driver = getDriver(activeDriverId);
  const stops = enviosDelDia;
  const total = resumenDelDia?.total ?? 0;
  const entregados = resumenDelDia?.entregados ?? 0;
  const enCamino = resumenDelDia?.en_camino ?? 0;
  const progress = total === 0 ? 0 : Math.round((entregados / total) * 100);
  const nombreRuta = resumenDelDia?.rutas[0]?.ruta_nombre ?? "Sin rutas asignadas hoy";

  return (
    <View style={styles.page}>
      <AuroraBackground style={StyleSheet.absoluteFill} />
      <FlatList
        data={stops}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={cargandoEnviosDelDia} onRefresh={recargarEnviosDelDia} />}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <View style={styles.topBar}><View><Text style={styles.greeting}>Buen día,</Text><Text style={styles.driverName}>{driver.name.split(" ")[0]}.</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>{driver.initials}</Text></View></View>
            {errorEnviosDelDia ? <Text style={styles.errorBanner}>{errorEnviosDelDia}</Text> : null}
            <GlassCard style={styles.summaryCard}>
              <View style={styles.summaryTop}><View><Text style={styles.summaryEyebrow}>MI RUTA DE HOY</Text><Text style={styles.summaryTitle}>{nombreRuta}</Text></View><View style={styles.progressValue}><Text style={styles.progressNumber}>{progress}%</Text><Text style={styles.progressText}>listo</Text></View></View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
              <View style={styles.summaryStats}><View><Text style={styles.statNumber}>{entregados}</Text><Text style={styles.statLabel}>entregadas</Text></View><View style={styles.statDivider} /><View><Text style={styles.statNumber}>{stops.length}</Text><Text style={styles.statLabel}>por visitar</Text></View><View style={styles.statDivider} /><View><Text style={styles.statNumber}>{enCamino}</Text><Text style={styles.statLabel}>en camino</Text></View></View>
              <View style={styles.mapAction}><IconAction label="Ver ruta en el mapa" icon="⌖" onPress={() => router.push("/route-map")} /><Text style={styles.mapActionChevron}>›</Text></View>
            </GlassCard>
            <SectionHeading eyebrow="PRÓXIMAS PARADAS" title="Tu recorrido" action="Mapa" onAction={() => router.push("/route-map")} />
          </View>
        }
        renderItem={({ item }) => <StopCard shipment={item} onPress={() => router.push({ pathname: "/stop/[id]", params: { id: item.id } })} />}
        ListEmptyComponent={!cargandoEnviosDelDia ? <Text style={styles.emptyText}>No tenés envíos asignados para hoy.</Text> : null}
        ListFooterComponent={<View style={{ height: 16 }} />}
      />
    </View>
  );
}
```

Mantener el `StyleSheet.create` existente y agregar dos estilos nuevos:

```ts
errorBanner: { color: "#D70015", fontSize: 12, fontWeight: "700", textAlign: "center", paddingVertical: 6 },
emptyText: { color: "#6E6E73", fontSize: 13, textAlign: "center", paddingTop: 40 },
```

- [ ] **Paso 2: Compilar**

```bash
cd gestion-envios/apps/mobile
pnpm check
```

Expected: sin errores. Si `resumenDelDia?.rutas[0]` o algún campo da error de tipos por `null`/`undefined`, revisar que los optional chaining (`?.`) y `??` estén en los lugares señalados arriba — no forzar con `!`.

- [ ] **Paso 3: Verificación manual con la API real y el teléfono**

1. Confirmar que la API Go está corriendo y escuchando (desde `gestion-envios/services/api`, con `.env` cargado): `go run ./cmd/api`. Si no está corriendo, levantarla.
2. Confirmar que el firewall de Windows permite conexiones entrantes al puerto 8080 (si el teléfono no puede conectar, revisar "Firewall de Windows Defender" → permitir la app `api.exe` o el puerto 8080 en redes privadas).
3. Confirmar la IP de red local vigente: `ipconfig` → buscar la IPv4 de la interfaz Wi-Fi. Si cambió respecto a `192.168.0.207`, actualizar `EXPO_PUBLIC_API_URL` en `gestion-envios/apps/mobile/.env`.
4. Desde `gestion-envios/apps/mobile`: `pnpm dev:metro`.
5. Con el teléfono en la MISMA red WiFi que la PC, abrir Expo Go y escanear el QR que imprime la terminal.
6. En la app: ingresar con `repartidor@movii.demo` / `Movii2026!`.
7. Confirmar que "Mi ruta de hoy" muestra los envíos reales del seed (o los que haya en la base en ese momento para el repartidor de la demo), no los 10 de la ruta mock "Ruta Norte 02".
8. Tirar de la lista hacia abajo (pull-to-refresh) y confirmar que vuelve a pedir los datos a la API sin errores.

Expected: login exitoso, lista de envíos real (no mock), refresh funcional. Si el login falla con error de red, es casi siempre la IP o el firewall — no un bug de código; ajustar y reintentar antes de tocar el código de la app.

- [ ] **Paso 4: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "feat: mostrar los envios reales del dia en Mi ruta de hoy

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Cobertura del spec:** completa la sección 3.4 (app móvil) del spec para HU-05 — login real y "Mi ruta de hoy" con datos reales, preservando el diseño visual del prototipo. El resto de las pantallas del prototipo (HU-06 a HU-09, tracking) queda fuera de alcance, tal como estaba previsto.

**Placeholders:** ninguno en el código — las únicas partes marcadas explícitamente como "verificar antes de continuar" son notas de atención (la prop `disabled` de `PrimaryButton`, el uso de `?.`/`??`), no placeholders de lógica faltante.

**Consistencia de tipos:** `EnvioDelDiaAPI`/`RutaConEnviosAPI`/`ResumenDelDiaAPI` (Task 2) reflejan exactamente el JSON que devuelve `domain.ResumenDelDia` del backend Go (mismos nombres de campo, `snake_case`, ya con tags JSON correctos desde el plan de HU-02/03/04). `mapEnvioDelDiaToShipment` produce un `Shipment` consumido sin cambios por `StopCard` (Task 5) y por `findShipment` (Task 3). `MoviiContextValue.login`/`logout` cambian de firma respecto al código actual (de síncrono con un rol de mentira, a async con email/password) — verificado que Task 4 (login.tsx) es el único otro consumidor de `login` y se actualiza en la misma tarea.
