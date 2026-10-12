<div align="center">

# 📦 Movii — Logistics Shipment Platform

**Full-stack monorepo: Go API + React web + Expo mobile + Supabase. Per-package CI and OpenAPI spec.**

[![Go](https://img.shields.io/badge/Go-1.27-00ADD8?logo=go)](https://go.dev/)
[![Expo](https://img.shields.io/badge/Expo-57-000020?logo=expo)](https://expo.dev/)
[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions)](https://github.com/features/actions)

**[📦 Repo](https://github.com/FelipeDiazAimar/Movii) · [🇪🇸 Español](README.md)**

</div>

## What is it?

End-to-end shipment management: customers quote/track (web + mobile), operators manage states/routes, one Go API over Postgres as source of truth. Real monorepo in `gestion-envios/`: pnpm workspace (`apps/*`), Go API (chi 5.3, pgx 5.10, JWT, golang-migrate, testify), React 19 + Vite 6 web (Query, Zod, Vitest), Expo 57 mobile (Router, tRPC 11, Drizzle, NativeWind), Supabase migrations/seeds/functions, `infra/docker`, OpenAPI 3.0.3 spec generated from real handlers, and three CI workflows (`api-ci`, `web-ci`, `mobile-ci`).

## Run it

```bash
git clone https://github.com/FelipeDiazAimar/Movii.git
cd Movii/gestion-envios
npm run setup   # installs web+mobile+go deps, creates .env files
npm run dev     # API :8080 + web :5173 + mobile :8081 with colored logs
```

Needs Node 20+, pnpm, Go 1.27+, Postgres (or Supabase). No public demo (requires DB + 3 services). Course project (sprints/Scrum/QA notes in `Apuntes/`) turned portfolio architecture piece.

## Author

**Felipe Diaz Aimar** — https://www.linkedin.com/in/felipe-aimar/ · felipediazaimar@gmail.com · https://github.com/FelipeDiazAimar · All rights reserved.
