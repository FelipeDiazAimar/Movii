#!/usr/bin/env node
// Build de Vercel: panel de operaciones (Vite) en / y app del repartidor (Expo
// web, PWA) en /app, en una sola carpeta estática (dist-vercel).
//
// La API corre aparte (Railway, ver docs/deploy.md). Variable en Vercel:
//   MOVII_API_URL  URL pública de la API, p. ej. https://movii-api.up.railway.app
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, "dist-vercel");
const api = (process.env.MOVII_API_URL ?? "").replace(/\/$/, "");
if (!api) {
  console.error("Falta MOVII_API_URL (URL pública de la API en Railway).");
  process.exit(1);
}

const run = (cmd, cwd, env) => execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, ...env } });

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

console.log("▶ Panel de operaciones (web)");
run("npm run build", path.join(root, "apps/web"), { VITE_API_URL: api, VITE_REPARTIDOR_URL: "/app/" });
cpSync(path.join(root, "apps/web/dist"), out, { recursive: true });

console.log("▶ App del repartidor (PWA en /app)");
run("npx expo export -p web --output-dir dist-web", path.join(root, "apps/mobile"), {
  EXPO_BASE_URL: "/app",
  EXPO_PUBLIC_API_URL: api,
  CI: "1",
});
cpSync(path.join(root, "apps/mobile/dist-web"), path.join(out, "app"), { recursive: true });

console.log(`✔ Listo en dist-vercel (API: ${api})`);
