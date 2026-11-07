import { useEffect } from "react";

/**
 * Hace que las barras del navegador móvil (estado arriba, herramientas abajo)
 * tengan el mismo color que la pantalla: actualiza `theme-color` y el fondo de
 * <html> (mitad superior / mitad inferior), que es lo que Safari y Chrome
 * muestran detrás de sus barras.
 */
export function useBordesNavegador(arriba: string, abajo: string = arriba) {
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.style.setProperty("--borde-sup", arriba);
    raiz.style.setProperty("--borde-inf", abajo);
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = arriba;
  }, [arriba, abajo]);
}
