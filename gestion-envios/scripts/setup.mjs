#!/usr/bin/env node
// Inicializa todo el monorepo (web + mobile + API Go) desde gestion-envios/.
// Uso: node scripts/setup.mjs   (o `npm run setup`)
import { spawnSync } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function run(label, cmd, args, cwd) {
  console.log(`\n\x1b[36m▶ ${label}\x1b[0m  (${cmd} ${args.join(" ")})`);
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: true });
  if (result.error || result.status !== 0) {
    console.error(`\x1b[31m✗ Falló: ${label}\x1b[0m`);
    process.exit(result.status ?? 1);
  }
}

function ensureEnv(relDir) {
  const dir = path.join(root, relDir);
  const envPath = path.join(dir, ".env");
  const examplePath = path.join(dir, ".env.example");
  if (!existsSync(envPath) && existsSync(examplePath)) {
    copyFileSync(examplePath, envPath);
    console.log(`\x1b[33m✓ Creado ${relDir}/.env a partir de .env.example — revisá los valores.\x1b[0m`);
  }
}

run("Instalando dependencias de la web", "npm", ["install"], path.join(root, "apps/web"));
run("Instalando dependencias de mobile", "npm", ["install"], path.join(root, "apps/mobile"));
run("Descargando dependencias de la API (Go)", "go", ["mod", "download"], path.join(root, "services/api"));

console.log("\n\x1b[36m▶ Verificando archivos .env\x1b[0m");
ensureEnv("apps/web");
ensureEnv("apps/mobile");
ensureEnv("services/api");

console.log(
  "\n\x1b[32m✓ Setup completo.\x1b[0m Corré `node scripts/dev.mjs` (o `npm run dev`) para levantar API + web + mobile juntos.",
);
