/**
 * Mapa de la app del repartidor: una página Leaflet + OpenStreetMap que se
 * muestra en un WebView (Android/iOS) o en un iframe (PWA). Así el mapa es el
 * mismo en todas las plataformas y no hace falta API key de Google Maps.
 *
 * La pantalla le manda el estado con `window.moviiMapa.actualizar(datos)` y el
 * mapa avisa los toques con postMessage {tipo: "parada", id}.
 */

export type ParadaMapaApp = {
  id: string;
  orden: number;
  estado: string;
  lat: number;
  lng: number;
  titulo: string;
  destacada?: boolean;
};

export type DatosMapaApp = {
  paradas: ParadaMapaApp[];
  /** Recorrido planificado [[lat,lng],...] (gris punteado). */
  recorrido?: [number, number][] | null;
  /** Camino resaltado hasta una parada (amarillo). */
  trayecto?: [number, number][] | null;
  camion?: { lat: number; lng: number; rumbo: number; patente: string } | null;
  deposito?: { lat: number; lng: number } | null;
  /** Cambiarlo vuelve a encuadrar el mapa. */
  encuadre?: string;
};

const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist";

export function htmlMapa(): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="${LEAFLET}/leaflet.css" />
<style>
  html, body, #mapa { margin: 0; height: 100%; width: 100%; background: #e9edef; }
  .leaflet-control-attribution { font-size: 9px; }
  .pin { color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font: 800 12px -apple-system, system-ui, sans-serif; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.35); }
</style>
</head><body>
<div id="mapa"></div>
<script src="${LEAFLET}/leaflet.js"></script>
<script>
(function () {
  var COLORES = { entregado: "#16a34a", en_camino: "#d97706", asignado: "#2563eb", no_entregado: "#dc2626", pendiente: "#6b7280" };
  var mapa = L.map("mapa", { zoomControl: false, attributionControl: true }).setView([-31.4279718, -62.0826608], 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(mapa);
  var capas = L.layerGroup().addTo(mapa);
  var camion = null, encuadre = null, animacion = null;

  function avisar(msg) {
    var texto = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(texto);
    else if (window.parent !== window) window.parent.postMessage({ moviiMapa: msg }, "*");
  }

  function iconoParada(p) {
    var t = p.destacada ? 34 : 26;
    return L.divIcon({ className: "", iconSize: [t, t], iconAnchor: [t / 2, t / 2],
      html: '<div class="pin" style="width:' + t + 'px;height:' + t + 'px;background:' + (COLORES[p.estado] || COLORES.pendiente) + '">' + p.orden + "</div>" });
  }
  function iconoCamion(rumbo) {
    return L.divIcon({ className: "", iconSize: [44, 44], iconAnchor: [22, 22],
      html: '<div style="position:relative;width:44px;height:44px"><div style="position:absolute;inset:0;transform:rotate(' + rumbo + 'deg)"><div style="position:absolute;left:50%;top:-2px;transform:translateX(-50%);border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:10px solid #1C1C1E"></div></div>' +
        '<div style="position:absolute;inset:5px;border-radius:50%;background:#1C1C1E;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFD60A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div></div>' });
  }
  function deslizar(marker, destino) {
    if (animacion) cancelAnimationFrame(animacion);
    var desde = marker.getLatLng(), inicio = performance.now();
    function paso(t) {
      var f = Math.min(1, (t - inicio) / 1500);
      marker.setLatLng([desde.lat + (destino[0] - desde.lat) * f, desde.lng + (destino[1] - desde.lng) * f]);
      if (f < 1) animacion = requestAnimationFrame(paso);
    }
    animacion = requestAnimationFrame(paso);
  }

  function actualizar(d) {
    capas.clearLayers();
    var puntos = [];
    if (d.recorrido && d.recorrido.length > 1 && !(d.trayecto && d.trayecto.length > 1)) {
      L.polyline(d.recorrido, { color: "#6b7280", weight: 4, opacity: 0.7, dashArray: "8 8" }).addTo(capas);
      puntos = puntos.concat(d.recorrido);
    }
    if (d.trayecto && d.trayecto.length > 1) {
      L.polyline(d.trayecto, { color: "#1C1C1E", weight: 9, opacity: 0.25 }).addTo(capas);
      L.polyline(d.trayecto, { color: "#FFD60A", weight: 5 }).addTo(capas);
      puntos = puntos.concat(d.trayecto);
    }
    if (d.deposito) {
      L.marker([d.deposito.lat, d.deposito.lng], { icon: L.divIcon({ className: "", iconSize: [28, 28], iconAnchor: [14, 14],
        html: '<div class="pin" style="width:28px;height:28px;border-radius:8px;background:#1C1C1E;color:#FFD60A">M</div>' }) }).addTo(capas);
    }
    (d.paradas || []).forEach(function (p) {
      var m = L.marker([p.lat, p.lng], { icon: iconoParada(p), zIndexOffset: p.destacada ? 800 : 0 }).addTo(capas);
      m.on("click", function () { avisar({ tipo: "parada", id: p.id }); });
      puntos.push([p.lat, p.lng]);
    });
    if (d.camion) {
      var pos = [d.camion.lat, d.camion.lng];
      if (!camion) camion = L.marker(pos, { icon: iconoCamion(d.camion.rumbo), zIndexOffset: 1000 }).addTo(mapa);
      else { camion.setIcon(iconoCamion(d.camion.rumbo)); deslizar(camion, pos); }
      puntos.push(pos);
    } else if (camion) { mapa.removeLayer(camion); camion = null; }

    var clave = d.encuadre || "inicial";
    if (puntos.length && clave !== encuadre) {
      encuadre = clave;
      mapa.invalidateSize();
      if (puntos.length === 1) mapa.setView(puntos[0], 15);
      else mapa.fitBounds(puntos, { padding: [30, 30], maxZoom: 16 });
    }
  }

  window.moviiMapa = { actualizar: actualizar };
  window.addEventListener("resize", function () { mapa.invalidateSize(); });
  avisar({ tipo: "listo" });
})();
</script>
</body></html>`;
}
