# AURA Fitness Club — Admin Panel

## Overview

Full-stack gym management system for the Algerian market. pnpm workspace monorepo with TypeScript throughout.

## Architecture

```
artifacts/
  admin/          — React + Vite admin panel (/ route, port 23744)
  api-server/     — Express 5 API server (/api route, port 8080)
  mockup-sandbox/ — Design prototyping server
lib/
  db/             — PostgreSQL schema + Drizzle ORM (@workspace/db)
  api-spec/       — OpenAPI spec + Orval codegen
  api-client-react/ — Generated React Query hooks (@workspace/api-client-react)
scripts/
  src/seed.ts     — Demo data seed script
```

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, drizzle-zod
- **Auth**: JWT (access + refresh tokens), bcryptjs
- **Admin UI**: React + Vite + shadcn/ui + Tailwind CSS + TanStack Query
- **Charts**: Recharts
- **Routing**: Wouter

## API Modules (all under /api)

| Route prefix | Module |
|---|---|
| /auth | Login, logout, refresh, /me |
| /members | Members CRUD + timeline/memberships/invoices/bookings/access-logs |
| /plans | Membership plans CRUD |
| /memberships | Member-plan assignments |
| /billing | Invoices + payments |
| /access | Access logs + points + QR check-in |
| /classes | Class types + sessions + bookings |
| /staff | Staff/users CRUD |
| /store | Products + orders/POS |
| /notifications | Notification templates |
| /reports | Dashboard, revenue, members, access, classes, store |
| /settings | System config + audit logs |

## Admin Pages

| Route | Purpose |
|---|---|
| /login | Auth (public) |
| / (dashboard) | KPIs, charts, alerts, recent activity |
| /members | Member list with search/filter |
| /members/:id | Member profile + tabs (memberships, invoices, bookings, access, timeline) |
| /plans | Membership plan management |
| /memberships | Active/expired membership list |
| /billing | Invoices + payments |
| /access | Access logs + access point management |
| /classes | Class types + session scheduling |
| /staff | Staff management |
| /store | Products + orders |
| /notifications | Notification templates |
| /reports | Revenue/member/access/class analytics |
| /settings | System config + audit trail |

## Auth Flow

JWT access tokens (stored in localStorage) + refresh tokens. `src/lib/api.ts` auto-refreshes on 401. `src/lib/auth.tsx` provides `AuthProvider` + `useAuth()` hook. All API calls use `api.get/post/patch/delete` from `src/lib/api.ts`.

## Demo Accounts

| Email | Role |
|---|---|
| admin@aurafitness.dz | super_admin |
| manager@aurafitness.dz | manager |
| reception@aurafitness.dz | reception |
| trainer@aurafitness.dz | trainer |

Password for all: `Admin@2024!`

## Key Commands

```bash
pnpm run typecheck                          # full typecheck
pnpm --filter @workspace/db run push       # push DB schema changes (dev)
pnpm --filter @workspace/scripts run seed  # run seed script
pnpm --filter @workspace/api-spec run codegen  # regenerate API hooks
```
