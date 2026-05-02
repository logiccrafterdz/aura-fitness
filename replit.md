# AURA Fitness Club — Admin Panel

## Overview

Full-stack gym management system for the Algerian market. pnpm workspace monorepo with TypeScript throughout.
Currency: DZD. Timezone: Africa/Algiers.

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

## DB Tables (lib/db/src/schema/)

| Table | Key fields |
|---|---|
| users | failedLoginAttempts, lockedUntil, role/permissions |
| members | firstNameAr, lastNameAr, phone (+213), memberNumber, status |
| memberships | status (active/frozen/expired/cancelled), freezeStart/End |
| membershipFreezeRequests | freezeStart, freezeEnd, reason, status (pending/approved/rejected), approvedBy, adminNotes |
| invoices | invoiceNumber, status, paymentMethod, baridimobRef |
| payments | method (cash/card/baridimob/cheque), status, confirmed/rejected |
| cashReconciliations | date, openingBalance, closingBalance, cashIn, cashOut, expectedBalance, discrepancy, status (open/closed/disputed) |
| accessLogs | result (allowed/denied), denialReason, ipAddress |
| notificationTemplates | key, eventTrigger, titleAr, titleFr, bodyAr, bodyFr, channels |
| notificationRecords | templateId, memberId, channel, status, sentAt |
| classTypes, classSessions, bookings | with waitlist + attendance |
| products, orders, posTransactions, inventoryTransactions | store + POS |
| loyaltyPoints, loyaltyRewards, pointsLedger | loyalty program |
| auditLogs, memberTimeline, systemConfig, businessRules | ops |

## API Modules (all under /api)

| Route prefix | Module |
|---|---|
| /auth | Login (with lockout), logout, refresh, /me, sessions list/revoke |
| /members | CRUD + timeline + memberships/invoices/bookings/access-logs + status transition with reason |
| /plans | Membership plans CRUD |
| /memberships | Member-plan assignments |
| /membership-freeze-requests | List all freeze requests; GET/POST /memberships/:id/freeze-requests; POST /:id/approve|reject |
| /billing | Invoices + payments (confirm/reject Baridimob) + discounts CRUD + cash reconciliation CRUD |
| /cash-reconciliations | GET list, GET /current, POST open, PATCH /:id close/update |
| /access | Access logs + points + QR verify with full enforcement + heartbeat + time rules |
| /classes | Class types + sessions + bookings + waitlist + attendance + recurring |
| /staff | Staff/users CRUD |
| /store | Products (barcode) + orders/POS (open/close sessions) + inventory |
| /notification-templates | CRUD for notification templates |
| /notification-records | Sent notification log |
| /notifications/send | Trigger notification by eventTrigger + memberId |
| /reports | Dashboard (enhanced metrics), revenue, members, access, classes, store |
| /settings | System config + audit logs |

## Admin Pages

| Route | Purpose |
|---|---|
| /login | Auth (public) |
| / (dashboard) | KPIs, charts, alerts, recent activity |
| /members | Member list with search/filter |
| /members/:id | Member profile + tabs (memberships, invoices, bookings, access, timeline, QR) + Change Status button |
| /plans | Membership plan management |
| /memberships | Active/expired membership list |
| /freeze-requests | Freeze request review — approve/reject with admin note |
| /billing | Invoices + payments (Baridimob confirm/reject) + discounts |
| /cash-reconciliation | Daily register open/close + reconciliation history with discrepancy alerts |
| /access | Access logs + access point management |
| /classes | Class types + session scheduling |
| /staff | Staff management |
| /store | Products + orders |
| /notifications | Notification templates (AR+FR) + sent records + Send dialog |
| /reports | Revenue/member/access/class analytics |
| /settings | System config + audit trail |
| /kiosk | Self-check-in kiosk terminal |
| /portal/:memberNumber | Member self-service portal |

## Hooks (artifacts/admin/src/hooks/use-api.ts)

Key hooks added in Phase 2:
- `useFreezeRequests`, `useApproveFreezeRequest`, `useRejectFreezeRequest`, `useCreateFreezeRequest`
- `useCashReconciliations`, `useCurrentCashReconciliation`, `useOpenCashReconciliation`, `useCloseCashReconciliation`
- `useMemberStatusChange` — POST /members/:id/status with reason
- `useSendNotification` — POST /notifications/send
- `useNotificationRecords` — paginated sent notification log

## Auth Flow

JWT access tokens (stored in localStorage) + refresh tokens. `src/lib/api.ts` auto-refreshes on 401. `src/lib/auth.tsx` provides `AuthProvider` + `useAuth()` hook. All API calls use `api.get/post/patch/delete` from `src/lib/api.ts`.

## Demo Accounts

| Email | Password | Role |
|---|---|---|
| admin@aurafitness.dz | Admin@2024! | super_admin |
| manager@aurafitness.dz | Manager@2024! | manager |
| reception@aurafitness.dz | Reception@2024! | reception |
| trainer@aurafitness.dz | Trainer@2024! | trainer |

## Seed Data Summary

- 50 members (25M + 25F, Arabic names, +213 phones)
- 50 memberships (35 active, 5 frozen, 5 expired, 5 cancelled)
- 5 plans (1500–5000 DZD)
- 10 class types, 115 sessions, 339 bookings
- 738 access log entries
- 20 products, 47 orders, 10 inventory transactions
- 6 cash reconciliation records (last 7 days)
- 5 pending freeze requests
- 10 notification templates (AR + FR)
- 40 invoices + payments (including Baridimob pending)

## Express 5 Quirks

- All `req.params.xxx` must be cast `as string` (ParamsDictionary is `string | string[]`)
- Use `req.log` in route handlers, singleton `logger` elsewhere (never `console.log` in server code)

## Key Commands

```bash
pnpm run typecheck                          # full typecheck (libs + all packages)
pnpm run typecheck:libs                     # rebuild composite libs first
pnpm --filter @workspace/db run push       # push DB schema changes (dev)
pnpm --filter @workspace/scripts run seed  # run seed script
pnpm --filter @workspace/api-spec run codegen  # regenerate API hooks
```
