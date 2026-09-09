#!/usr/bin/env node
// Levanta la API (Go), la web (Vite) y mobile (Expo) juntos desde gestion-envios/.
// Uso: node scripts/dev.mjs   (o `npm run dev`)
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const procs = [
  {
    name: "API",
    color: "34", // azul
    cmd: "go",
    args: ["run", "./cmd/api"],
    cwd: path.join(root, "services/api"),
  },
  {
    name: "WEB",
    color: "32", // verde
    cmd: "npm",
    args: ["run", "dev"],
    cwd: path.join(root, "apps/web"),
  },
  {
    name: "MOBILE",
    color: "35", // magenta
    cmd: "npm",
    args: ["run", "dev"],
    cwd: path.join(root, "apps/mobile"),
  },
];

const children = [];
let shuttingDown = false;

function log(name, color, data) {
  for (const line of data.toString().split(/\r?\n/)) {
    if (line.length === 0) continue;
    console.log(`\x1b[${color}m[${name}]\x1b[0m ${line}`);
  }
}

function killTree(child) {
  if (process.platform === "win32") {
    // En Windows, spawn(..., { shell: true }) crea un cmd.exe envoltorio.
    // child.kill() solo mata ese cmd.exe, no los procesos hijos reales
    // (p.ej. el binario compilado por `go run`), que quedan huérfanos
    // reteniendo puertos. taskkill /T mata todo el árbol de procesos.
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    child.kill();
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null) killTree(child);
  }
  process.exit(code ?? 0);
}

for (const p of procs) {
  const child = spawn(p.cmd, p.args, { cwd: p.cwd, shell: true });
  children.push(child);
  child.stdout?.on("data", (d) => log(p.name, p.color, d));
  child.stderr?.on("data", (d) => log(p.name, p.color, d));
  child.on("exit", (code) => {
    console.log(`\x1b[${p.color}m[${p.name}]\x1b[0m proceso terminado (code ${code})`);
    shutdown(code ?? 1);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
