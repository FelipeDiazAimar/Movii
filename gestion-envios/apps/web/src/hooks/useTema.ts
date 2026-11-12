import { useCallback, useEffect, useState } from "react";

/**
 * Tema del panel de operadores: "oscuro" es el look de siempre (menú lateral
 * asfalto) y "claro" lo pasa todo a claro. Se marca en <html data-tema="...">
 * y Tailwind lo lee con la variante `claro:` (ver tailwind.config.js).
 */
export type Tema = "oscuro" | "claro";

const CLAVE = "movii.web.tema";

export function leerTema(): Tema {
  try {
    return localStorage.getItem(CLAVE) === "claro" ? "claro" : "oscuro";
  } catch {
    return "oscuro";
  }
}

function aplicar(tema: Tema) {
  document.documentElement.dataset.tema = tema;
}

/** Aplica el tema guardado antes de montar React, para que no parpadee. */
export function aplicarTemaGuardado() {
  aplicar(leerTema());
}

export function useTema() {
  const [tema, setTema] = useState<Tema>(leerTema);

  useEffect(() => {
    aplicar(tema);
  }, [tema]);

  const alternar = useCallback(() => {
    setTema((actual) => {
      const nuevo: Tema = actual === "claro" ? "oscuro" : "claro";
      try {
        localStorage.setItem(CLAVE, nuevo);
      } catch {
        // sin almacenamiento: solo dura esta sesión
      }
      return nuevo;
    });
  }, []);

  return { tema, alternar };
}
