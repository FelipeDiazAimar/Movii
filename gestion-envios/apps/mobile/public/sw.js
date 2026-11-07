/* Service worker de la PWA del repartidor (Movii).
 * - Navegación: red primero; sin conexión, el shell guardado (la app abre igual).
 * - Archivos estáticos con hash (_expo/static): caché primero (no cambian nunca).
 * - API (/api) y mapas: siempre a la red, nunca se cachean (datos en vivo).
 */
const VERSION = "movii-app-v1";
const SHELL = ["/app/", "/app/manifest.webmanifest", "/app/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(VERSION).then((c) => c.put("/app/", copia));
          return res;
        })
        .catch(() => caches.match("/app/")),
    );
    return;
  }

  if (url.pathname.includes("/_expo/static/") || url.pathname.startsWith("/app/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copia = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copia));
            return res;
          }),
      ),
    );
  }
});
