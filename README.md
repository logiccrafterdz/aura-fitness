# AURA Fitness Club — Management System

Full-stack gym management system built for the Algerian market.

## Stack

| Layer | Technology |
|---|---|
| Backend | Express 5 + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Frontend | React 18 + Vite + TailwindCSS |
| Auth | JWT (access + refresh tokens) |
| Currency | DZD (Algerian Dinar) |
| Timezone | Africa/Algiers |

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- PostgreSQL 15+

### Setup

```bash
# Install dependencies
pnpm install

# Push schema to DB
pnpm --filter @workspace/db run push

# Seed demo data (50 members, Arabic names)
pnpm --filter @workspace/scripts run seed
```

### Development

Workflows start automatically in the Replit environment. To run manually:

```bash
# API server (port from $PORT env var)
pnpm --filter @workspace/api-server run dev

# Admin panel (port from $PORT env var)
pnpm --filter @workspace/admin run dev
```

### Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@aurafitness.dz | Admin@2024! |

## Modules

### Members
- Full profile management (name, Arabic name, phone, gender, DOB)
- Member number (AURYYnnnnn format)
- Status: active / inactive / suspended / pending
- Timeline of events (joins, status changes, freeze requests)

### Memberships
- Plans with pricing in DZD
- Status: active / frozen / expired / cancelled / pending
- Freeze requests with admin approve/reject workflow
- Auto-expiry engine (POST /api/memberships/auto-expire)

### Billing
- Invoices with DZD amounts
- Payment methods: Cash, BaridiMob, CIB, Edahabia
- Pending BaridiMob confirmation workflow
- Daily cash register (open/close with discrepancy detection)
- Discount codes (percent or fixed)

### Access Control
- QR code generation (60-second rotating JWT)
- Full-screen kiosk terminal for staff
- Self-service member portal with QR self-check-in
- Access logs with deny reasons
- Time-based access rules
- Rate limiting: 10 verify attempts/IP/minute

### Classes
- Class types with colour coding
- Sessions with capacity and booking management
- Waitlist support

### Store
- Product catalogue with stock tracking
- Orders and order items
- Low stock alerts on dashboard

### Notifications
- Trigger-based templates (AR + FR)
- Sent records with delivery status

### Reports & Dashboard
- Real-time KPIs (members, revenue, access, bookings)
- Expiring-soon list (7 days)
- Today's class schedule
- Recent access feed
- Revenue by payment method (chart)
- BaridiMob pending alert banner

## API Routes

Base path: `/api`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | /auth/login | Public | Login, returns access + refresh tokens |
| POST | /auth/refresh | Public | Refresh access token |
| GET | /members | Admin | Paginated member list |
| POST | /members | Admin | Create member |
| GET | /members/by-number/:n | Public | Member portal lookup |
| POST | /memberships/auto-expire | Admin | Expire overdue + resume unfrozen |
| GET | /portal/access-token/:n | Public | Generate QR for self-service portal |
| POST | /access/verify | Public (rate-limited) | Verify QR token |
| GET | /reports/dashboard | Admin | Full dashboard metrics |

See individual route files in `artifacts/api-server/src/routes/` for full endpoint documentation.

## Database Indexes

Key indexes added for performance:

- `members`: status, created_at
- `memberships`: member_id, status, end_date, (status, end_date) composite
- `access_logs`: created_at, member_id, result
- `invoices`: member_id, status, created_at
- `payments`: member_id, status, method, confirmed_at

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| DATABASE_URL | Yes | PostgreSQL connection string |
| JWT_SECRET | Yes | Secret for admin JWT tokens |
| QR_SECRET | Yes | Secret for QR access tokens (default: aura-qr-secret) |
| SESSION_SECRET | Yes | Express session secret |
| PORT | Yes | Server port (set by Replit) |

## Project Structure

```
artifacts/
  admin/          # React+Vite admin panel
  api-server/     # Express 5 API
lib/
  db/             # Drizzle schema + client
  api-zod/        # Generated Zod schemas & React Query hooks
scripts/
  src/seed.ts     # Demo data seeder
```
