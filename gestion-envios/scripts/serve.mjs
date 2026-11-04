#!/usr/bin/env node
// Todo en un solo puerto, servido por Go: node scripts/serve.mjs  (o `npm run serve`)
//   http://localhost:8080/       panel de operaciones (web React)
//   http://localhost:8080/app/   panel del repartidor (app Expo exportada para web)
//   http://localhost:8080/api/   API
// Agregá --skip-build para reutilizar los builds anteriores.
import { spawnSync, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const web = path.join(root, "apps/web");
const mobile = path.join(root, "apps/mobile");
const api = path.join(root, "services/api");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(cmd, args, cwd, env = {}) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!process.argv.includes("--skip-build")) {
  run(npx, ["vite", "build"], web, { VITE_API_URL: "/api" });
  run(npx, ["expo", "export", "-p", "web", "--output-dir", "dist-web"], mobile, {
    EXPO_BASE_URL: "/app",
    EXPO_PUBLIC_API_URL: "/api",
    CI: "1",
  });
}

const child = spawn("go", ["run", "./cmd/api"], {
  cwd: api,
  stdio: "inherit",
  env: { ...process.env, WEB_DIR: path.join(web, "dist"), APP_DIR: path.join(mobile, "dist-web") },
});
child.on("exit", (code) => process.exit(code ?? 0));
