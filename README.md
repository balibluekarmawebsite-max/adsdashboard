# Ads Analytics Dashboard

A self-hosted dashboard that pulls advertising data from **Google Ads** and **Meta
(Facebook/Instagram) Ads**, unifies it into one PostgreSQL database, and displays it in a clean,
professional interface. Built for **Blue Karma Secrets** to see ad performance across every
property (BKDS, BKDU, BKV, Oracle Yacht) in one place.

> **Status:** Phases 1–6 built — the app is feature-complete. Full backend
> (DB + auth, **Google** + **Meta** connectors → `metrics_daily`, daily scheduler,
> aggregation API) plus the **dashboard UI**: filters (date/platform/property),
> KPI cards with favorable-direction deltas, an animated trend chart, Google-vs-Meta
> and property breakdowns, and a sortable/searchable campaign table — in the Blue
> Karma theme with a colorblind-safe chart palette. Connectors need live
> credentials for real data. **Deployment to the VPS (Phase 7)** is next.

---

## Stack

| Layer      | Choice                                               |
| ---------- | ---------------------------------------------------- |
| Framework  | Next.js 16 (App Router) + TypeScript (strict)        |
| Database   | PostgreSQL + Prisma ORM                              |
| Auth       | Auth.js (NextAuth) — _added in Phase 2_              |
| UI         | Tailwind CSS v4 + shadcn/ui (new-york, neutral base) |
| Charts     | Recharts — _added in Phase 6_                        |
| Animation  | Motion (Framer Motion) — _added in Phase 6_          |
| Scheduling | node-cron — _added in Phase 5_                       |
| Tooling    | ESLint + Prettier                                    |

The core idea: **don't call the ad APIs on every page load.** A daily job pulls data into a
unified `metricsDaily` table; the dashboard only ever reads our own database — fast and
rate-limit safe.

---

## Requirements

- **Node.js 20+** (developed on Node 22)
- **PostgreSQL 14+** (local for dev; on the server later) — _needed from Phase 2_
- npm

---

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file and fill it in
cp .env.example .env
#    (DATABASE_URL / AUTH_SECRET etc. become relevant from Phase 2 onward)

# 3. Run the dev server
npm run dev
```

Open <http://localhost:3000> — you should see the dark placeholder landing page.

### Scripts

| Command                | What it does                      |
| ---------------------- | --------------------------------- |
| `npm run dev`          | Start the dev server              |
| `npm run build`        | Production build                  |
| `npm run start`        | Run the production build          |
| `npm run lint`         | ESLint                            |
| `npm run typecheck`    | TypeScript type check (no emit)   |
| `npm run format`       | Format the codebase with Prettier |
| `npm run format:check` | Check formatting without writing  |

---

## Environment variables

All configuration lives in `.env` (git-ignored). **`.env.example` is the single source of truth**
for what each variable is — it is grouped by the phase that introduces it and marks which values
are secret. Never commit real secrets.

---

## Project structure

Config files live at the root; all application code lives under `src/`. Directories are created
as each phase needs them — this is the target shape:

```
adsdashboard/
├── prisma/                  # Prisma schema, migrations, seed script        (Phase 2)
├── scripts/                 # CLI entry points: sync:google / sync:meta / …  (Phase 3–5)
├── public/                  # static assets
└── src/
    ├── app/                 # Next.js App Router
    │   ├── (dashboard)/     # protected dashboard routes + widgets           (Phase 6)
    │   ├── api/             # route handlers: /api/sync/*, /api/metrics/*    (Phase 3–5)
    │   ├── login/           # auth pages                                     (Phase 2)
    │   ├── layout.tsx       # root layout (fonts, theme)
    │   ├── page.tsx         # landing page
    │   └── globals.css      # Tailwind v4 + design tokens
    ├── components/
    │   └── ui/              # shadcn/ui primitives
    ├── config/              # app config (conversion action types, timezone) (Phase 4–5)
    ├── lib/
    │   ├── db/              # Prisma client singleton                        (Phase 2)
    │   ├── auth/            # Auth.js configuration                          (Phase 2)
    │   ├── crypto/          # token encryption helpers                       (Phase 2)
    │   ├── google/          # GoogleAdsConnector                             (Phase 3)
    │   ├── meta/            # MetaAdsConnector                               (Phase 4)
    │   ├── metrics/         # aggregation / query helpers                    (Phase 5)
    │   └── utils.ts         # shared helpers (cn, formatters)
    └── types/               # shared TypeScript types
```

---

## Roadmap

| #   | Phase                    | Outcome                                       |
| --- | ------------------------ | --------------------------------------------- |
| 01  | Foundations & API access | Scaffold pushed to GitHub _(this phase)_      |
| 02  | Backend core & database  | Prisma schema, migrations, auth, encryption   |
| 03  | Google Ads integration   | Google data flowing into `metricsDaily`       |
| 04  | Meta Ads integration     | Meta data alongside Google                    |
| 05  | Data sync & aggregation  | Daily auto-sync + `/api/metrics/*` endpoints  |
| 06  | Dashboard frontend       | KPIs, charts, filters, animations             |
| 07  | Deployment               | Live at `ads.bluekarmasecrets.com` over HTTPS |
| 08  | Hardening & maintenance  | Security, monitoring, backups, token refresh  |

---

## Deployment

Target: the existing **Bluehost dedicated server (cPanel/WHM on AlmaLinux 9)** that hosts
`bluekarmasecrets.com`, served at the subdomain **`ads.bluekarmasecrets.com`**.

To avoid any risk to the live site, deployment uses the cPanel-native path (subdomain +
reverse proxy + Node/PostgreSQL on the host + cPanel AutoSSL) rather than Docker.

**Full copy-paste runbook: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).** The deploy kit lives in
`deploy/` (Apache proxy configs), `ecosystem.config.cjs` (PM2), `scripts/server-deploy.sh` +
`scripts/backup-db.sh`, and `.github/workflows/deploy.yml` (push-to-`main` → SSH deploy).

## Security

- `.env` is git-ignored; secrets never enter the repo, image layers, or logs.
- Platform tokens are encrypted at rest (Phase 2).
- Read-only API scopes only (`ads_read` / `read_insights`).
