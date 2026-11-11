#!/usr/bin/env node
// Abre la app del repartidor en el celular con Expo Go.
//
// Uso: node scripts/celular.mjs [prod|local] [wifi|tunel] [ip=192.168.x.x]
//   (o doble clic en celular.bat; sin argumentos pregunta)
//
//   prod  → la app usa la API de producción (Railway). No levanta nada más.
//   local → levanta también la API en esta PC (go run ./cmd/api) y la app la usa
//           por la IP de la red. Exige que services/api/.env apunte a una base
//           propia, nunca a la Supabase compartida (es la de producción).
//   wifi  → el celular y la PC en la misma red (lo más rápido).
//   tunel → Expo por túnel (ngrok): sirve si la red no deja que el celular vea
//           a la PC (wifi de facultad, datos móviles). Solo con prod.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dirMobile = path.join(root, "apps/mobile");
const dirApi = path.join(root, "services/api");
const API_PROD = "https://movii-production.up.railway.app/api";
const REGLA_FIREWALL = "Movii-ExpoGo";
const esWindows = process.platform === "win32";

const c = (codigo, txt) => `\x1b[${codigo}m${txt}\x1b[0m`;
const titulo = (t) => console.log("\n" + c("1;33", t));
const ok = (t) => console.log(c("32", "  ✔ ") + t);
const aviso = (t) => console.log(c("33", "  ! ") + t);
const error = (t) => console.log(c("31", "  ✖ ") + t);

// ---------- argumentos o menú ----------
const args = process.argv.slice(2).map((a) => a.toLowerCase());
let modo = args.find((a) => a === "prod" || a === "local");
let conexion = args.find((a) => a === "wifi" || a === "tunel" || a === "lan");
if (conexion === "lan") conexion = "wifi";
const ipForzada = args.find((a) => a.startsWith("ip="))?.slice(3);

if (!modo || !conexion) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  if (!modo) {
    titulo("¿Contra qué API?");
    console.log("  1) Producción (Railway)  ← para presentar");
    console.log("  2) API local en esta PC");
    modo = (await rl.question("  Opción [1]: ")).trim() === "2" ? "local" : "prod";
  }
  if (!conexion) {
    if (modo === "local") {
      conexion = "wifi";
    } else {
      titulo("¿Cómo se conecta el celular?");
      console.log("  1) Misma Wi-Fi que la PC  ← más rápido");
      console.log("  2) Túnel (si la red no deja, o el celular usa datos)");
      conexion = (await rl.question("  Opción [1]: ")).trim() === "2" ? "tunel" : "wifi";
    }
  }
  rl.close();
}
if (modo === "local" && conexion === "tunel") {
  error("El túnel solo cubre Expo, no la API local: con 'local' hay que usar 'wifi'.");
  process.exit(1);
}

// ---------- IP de la red ----------
function ipDeLaRed() {
  if (ipForzada) return ipForzada;
  if (esWindows) {
    // La interfaz con la ruta por defecto de menor métrica (evita VirtualBox, WSL, VPNs).
    const ps =
      "$r = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | " +
      "Sort-Object { $_.RouteMetric + (Get-NetIPInterface -InterfaceIndex $_.ifIndex -AddressFamily IPv4).InterfaceMetric } | " +
      "Select-Object -First 1; if ($r) { (Get-NetIPAddress -InterfaceIndex $r.ifIndex -AddressFamily IPv4 | Select-Object -First 1).IPAddress }";
    const r = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
    const ip = r.stdout?.trim().split(/\r?\n/)[0];
    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
  }
  const virtuales = /virtual|vmware|vethernet|wsl|hyper-v|radmin|hamachi|tailscale|zerotier|loopback/i;
  for (const [nombre, dirs] of Object.entries(os.networkInterfaces())) {
    if (virtuales.test(nombre)) continue;
    const v4 = dirs?.find((d) => d.family === "IPv4" && !d.internal);
    if (v4) return v4.address;
  }
  return null;
}

function puertoLibre(puerto) {
  return new Promise((resolve) => {
    const s = net.createServer().once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true))).listen(puerto, "0.0.0.0");
  });
}

// ---------- firewall de Windows ----------
function asegurarFirewall() {
  if (!esWindows) return;
  const existe = spawnSync("netsh", ["advfirewall", "firewall", "show", "rule", `name=${REGLA_FIREWALL}`], { stdio: "ignore" });
  if (existe.status === 0) {
    ok(`Firewall: regla ${REGLA_FIREWALL} ya creada (puertos 8080 y 8081).`);
    return;
  }
  aviso("Firewall: falta permitir los puertos 8080 y 8081. Windows va a pedir permiso de administrador (una sola vez).");
  const cmd =
    `New-NetFirewallRule -DisplayName '${REGLA_FIREWALL}' -Name '${REGLA_FIREWALL}' -Direction Inbound ` +
    `-Protocol TCP -LocalPort 8080,8081 -Action Allow -Profile Any | Out-Null`;
  const codificado = Buffer.from(cmd, "utf16le").toString("base64");
  spawnSync(
    "powershell",
    ["-NoProfile", "-Command", `Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-EncodedCommand','${codificado}'`],
    { stdio: "inherit" },
  );
  const otraVez = spawnSync("netsh", ["advfirewall", "firewall", "show", "rule", `name=${REGLA_FIREWALL}`], { stdio: "ignore" });
  if (otraVez.status === 0) ok("Firewall: regla creada.");
  else aviso("No se pudo crear la regla. Si el celular no conecta, aceptá el aviso del firewall o usá el modo túnel.");
}

function leerEnv(archivo) {
  const vars = {};
  if (!fs.existsSync(archivo)) return vars;
  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) vars[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return vars;
}

async function esperarApi(url, segundos) {
  for (let i = 0; i < segundos; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return true;
    } catch {
      /* todavía no levantó */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function matarArbol(hijo) {
  if (!hijo || hijo.exitCode !== null) return;
  if (esWindows) spawnSync("taskkill", ["/pid", String(hijo.pid), "/T", "/F"], { stdio: "ignore" });
  else hijo.kill();
}

// ---------- preparación ----------
titulo(`Movii en el celular — API ${modo === "prod" ? "de producción" : "local"}, conexión por ${conexion === "wifi" ? "Wi-Fi" : "túnel"}`);

if (!fs.existsSync(path.join(dirMobile, "node_modules"))) {
  error("Faltan las dependencias de la app: correr `npm run setup` en gestion-envios (o usar celular.bat).");
  process.exit(1);
}

let ip = null;
if (conexion === "wifi") {
  ip = ipDeLaRed();
  if (!ip) {
    error("No encontré la IP de la red. Pasala a mano: celular.bat prod wifi ip=192.168.x.x");
    process.exit(1);
  }
  ok(`IP de esta PC en la red: ${c("1", ip)}  (el celular tiene que estar en la misma Wi-Fi)`);
  asegurarFirewall();
}

if (!(await puertoLibre(8081))) {
  error("El puerto 8081 está ocupado (¿quedó otro Expo o `npm run dev` abierto?). Cerralo y volvé a probar.");
  process.exit(1);
}

let apiUrl;
let api = null;
if (modo === "prod") {
  apiUrl = API_PROD;
  if (await esperarApi(`${API_PROD}/health`, 1)) ok(`Producción responde: ${API_PROD}`);
  else aviso(`Producción no respondió a /health (${API_PROD}). La app puede no andar.`);
  const enMain = spawnSync("git", ["merge-base", "--is-ancestor", "HEAD", "origin/main"], { cwd: root, stdio: "ignore" });
  if (enMain.status !== 0) aviso("Esta rama tiene commits que no están en main: producción no los tiene.");
} else {
  const env = leerEnv(path.join(dirApi, ".env"));
  if (/supabase/i.test(env.DATABASE_URL ?? "")) {
    error("services/api/.env apunta a la Supabase compartida (la base de PRODUCCIÓN).");
    error("Con 'local' hace falta una base propia en DATABASE_URL. Para presentar usá 'prod'.");
    process.exit(1);
  }
  if (!(await puertoLibre(8080))) {
    error("El puerto 8080 está ocupado (¿ya hay una API corriendo?). Cerrala y volvé a probar.");
    process.exit(1);
  }
  apiUrl = `http://${ip}:8080`;
  const logApi = path.join(os.tmpdir(), "movii-api-celular.log");
  const salida = fs.openSync(logApi, "w");
  console.log("  … levantando la API (go run ./cmd/api)");
  api = spawn("go", ["run", "./cmd/api"], { cwd: dirApi, shell: true, stdio: ["ignore", "pipe", "pipe"] });
  const alLog = (d) => {
    fs.writeSync(salida, d);
    // El código de 6 dígitos del login va al log cuando WhatsApp/mail están deshabilitados.
    for (const linea of d.toString().split(/\r?\n/)) {
      if (/deshabilitado\]|2fa:|c[oó]digo/i.test(linea)) console.log(c("36", "[API] ") + linea);
    }
  };
  api.stdout.on("data", alLog);
  api.stderr.on("data", alLog);
  api.on("exit", (code) => {
    if (code) error(`La API terminó (code ${code}). Log: ${logApi}`);
  });
  if (!(await esperarApi("http://127.0.0.1:8080/health", 90))) {
    error(`La API no levantó en 90 s. Log: ${logApi}`);
    matarArbol(api);
    process.exit(1);
  }
  ok(`API local en ${apiUrl}  (log completo: ${logApi})`);
}

// ---------- Expo ----------
titulo("Pasos en el celular");
console.log("  1. Instalar Expo Go (Play Store / App Store).");
console.log("  2. Android: abrir Expo Go → \"Scan QR code\". iPhone: escanear con la cámara.");
console.log("  3. El primer arranque compila todo (~1 min). Después, \"r\" en esta ventana recarga la app.");
console.log("  Ctrl+C cierra todo.\n");

const env = {
  ...process.env,
  EXPO_PUBLIC_API_URL: apiUrl,
  EXPO_USE_METRO_WORKSPACE_ROOT: "1",
  ...(ip ? { REACT_NATIVE_PACKAGER_HOSTNAME: ip } : {}),
};
// --clear: EXPO_PUBLIC_API_URL queda incrustada en el bundle; sin limpiar la caché
// podría quedar la URL de la corrida anterior (prod ↔ local).
const expoArgs = ["expo", "start", "--go", "--port", "8081", "--clear", conexion === "tunel" ? "--tunnel" : "--lan"];
const expo = spawn("npx", expoArgs, { cwd: dirMobile, shell: true, stdio: "inherit", env });

const cerrar = () => {
  matarArbol(api);
  matarArbol(expo);
  process.exit(0);
};
process.on("SIGINT", cerrar);
process.on("SIGTERM", cerrar);
expo.on("exit", () => {
  matarArbol(api);
  process.exit(0);
});
