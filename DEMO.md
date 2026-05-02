# AURA Fitness — 5-Minute Demo Guide

A walkthrough of every major feature. Use these steps after seeding the database.

## Credentials
- **URL**: open the preview pane
- **Email**: admin@aurafitness.dz
- **Password**: Admin@2024!

---

## 1. Dashboard (30 seconds)

1. Log in — you land on the **Dashboard**.
2. Notice the KPI cards: total members, active memberships, today's revenue (DZD), today's access count.
3. Check the **BaridiMob Pending** alert badge (orange) — shows unconfirmed mobile payments.
4. Scroll down: **Expiring Soon** list, **Today's Classes** schedule, **Low Stock** products, and the live **Access Feed**.

---

## 2. Member Management (1 minute)

1. Click **Members** in the sidebar.
2. Search for `يوسف` (Arabic) or `AUR` to filter — 50 demo members with Algerian names.
3. Click any member to open their **detail page**.
4. Notice the **Timeline** tab — shows all events (joins, status changes).
5. Click **Change Status** → select `suspended` with a reason → save.
6. Click **Memberships** tab → see the active plan, dates, frozen days used.

---

## 3. Freeze Request Workflow (1 minute)

1. On a member detail page, go to the **Memberships** tab.
2. Click **Freeze Membership** → set start/end dates and reason → submit.
3. Go to **Freeze Requests** in the sidebar.
4. Find the pending request → click **Approve** (or **Reject** with admin notes).
5. Return to the member — membership status is now `frozen`.

---

## 4. Billing & BaridiMob (30 seconds)

1. Click **Billing** in the sidebar.
2. Filter by **Method: BaridiMob** and **Status: Pending**.
3. Click a payment row → **Confirm** (enter reference number) or **Reject**.
4. Revenue dashboard KPI updates on next refresh.

---

## 5. Cash Register (30 seconds)

1. Click **Cash Register** in the sidebar.
2. Click **Open Register** — enter opening balance in DZD.
3. At end of day, click **Close Register** — enter actual closing balance.
4. If closing ≠ expected, a **discrepancy** is highlighted in red.

---

## 6. Member Self-Service Portal + QR Check-In (1 minute)

The portal is a public page members access on their phone.

1. Open a new tab and navigate to `/portal/AUR26XXXXX` (replace with any member number from the Members list).
2. The member's name, status, and plan appear automatically.
3. Click **Generate QR Code** — a rotating QR code appears (valid 60 seconds).
4. Open **another tab** and go to `/kiosk`.

### Kiosk Terminal

1. The kiosk is a full-screen dark terminal designed for a front-desk tablet.
2. Paste the QR token (from the browser console, or use the **Test** button if available).
3. If the member is active and the membership is valid: green **ACCESS GRANTED** banner with member name.
4. If the membership is expired or member is suspended: red **ACCESS DENIED** with reason.
5. All attempts are logged — visible in Dashboard → Access Feed.

---

## 7. Auto-Expiry Engine (15 seconds)

The system can auto-expire overdue memberships and auto-resume unfrozen ones:

```bash
curl -X POST /api/memberships/auto-expire \
  -H "Authorization: Bearer <token>"
```

Response: `{ "expired": 2, "resumed": 1, "processedAt": "..." }`

This also runs automatically from the Dashboard on load (via the admin panel).

---

## 8. Notifications (30 seconds)

1. Click **Notifications** in the sidebar.
2. **Templates tab**: 10 pre-built trigger templates (membership_expiry, payment_confirmed, etc.) — each in Arabic and French.
3. **Sent Records tab**: history of all dispatched notifications.
4. Click **Send Notification** → choose a template, select a member → send.

---

## 9. Reports (30 seconds)

1. Click **Reports** in the sidebar.
2. Toggle between Revenue, Members, Access, Classes, and Store tabs.
3. Revenue chart shows daily/weekly/monthly breakdown by payment method.
4. Access report shows peak hours and denial reasons.

---

## Key Demo Talking Points

| Feature | Detail |
|---|---|
| Arabic names | All 50 demo members have authentic Algerian Arabic names + +213 phone numbers |
| DZD currency | All prices and revenue shown in Algerian Dinar |
| QR security | 60-second rotating JWT signed with QR_SECRET, rate-limited 10/min/IP |
| Offline-ready kiosk | `/kiosk` works as a full-screen PWA-style terminal |
| DB indexes | 12 indexes across 4 tables for production-grade query speed |
| Audit trail | Every status change, payment action, and freeze logged with actor ID |
