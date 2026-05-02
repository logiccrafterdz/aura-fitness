import { db } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  rolesTable,
  permissionsTable,
  rolePermissionsTable,
  usersTable,
  membersTable,
  plansTable,
  membershipsTable,
  invoicesTable,
  invoiceItemsTable,
  paymentsTable,
  accessPointsTable,
  accessLogsTable,
  classTypesTable,
  classSessionsTable,
  bookingsTable,
  productsTable,
  notificationTemplatesTable,
  systemConfigTable,
  businessRulesTable,
  timeRulesTable,
  memberTimelineEventsTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";

async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

async function seed() {
  console.log("🌱 Starting seed...");

  // Roles
  const roles = await db
    .insert(rolesTable)
    .values([
      { name: "super_admin", description: "Full system access" },
      { name: "manager", description: "Club manager — full operational access" },
      { name: "reception", description: "Front desk staff" },
      { name: "trainer", description: "Fitness trainer" },
      { name: "accountant", description: "Billing and finance access" },
    ])
    .onConflictDoNothing()
    .returning();
  console.log(`✓ ${roles.length} roles`);

  // Permissions
  const resources = ["members", "plans", "memberships", "invoices", "payments", "access", "classes", "staff", "store", "reports", "settings", "audit_logs"];
  const actions = ["create", "read", "update", "delete"];
  const permValues = resources.flatMap((r) => actions.map((a) => ({ resource: r, action: a })));
  const perms = await db.insert(permissionsTable).values(permValues).onConflictDoNothing().returning();
  console.log(`✓ ${perms.length} permissions`);

  // Role permissions — map by role name
  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r.id]));
  const permMap: Record<string, string> = {};
  for (const p of perms) permMap[`${p.resource}:${p.action}`] = p.id;

  // super_admin: all permissions
  // manager: all except settings delete
  // reception: members read/create, invoices read, payments create, access read, classes read
  // trainer: members read, classes read/update, access read
  // accountant: invoices all, payments all, reports read, members read

  const rolePermEntries: Array<{ roleId: string; permissionId: string }> = [];

  const addPerms = (roleName: string, pairs: string[]) => {
    for (const key of pairs) {
      if (roleMap[roleName] && permMap[key]) {
        rolePermEntries.push({ roleId: roleMap[roleName], permissionId: permMap[key] });
      }
    }
  };

  const allPerms = resources.flatMap((r) => actions.map((a) => `${r}:${a}`));
  addPerms("super_admin", allPerms);
  addPerms("manager", allPerms.filter((p) => p !== "settings:delete"));
  addPerms("reception", ["members:create", "members:read", "members:update", "invoices:read", "payments:create", "payments:read", "access:read", "classes:read", "memberships:read"]);
  addPerms("trainer", ["members:read", "classes:read", "classes:update", "access:read"]);
  addPerms("accountant", ["invoices:create", "invoices:read", "invoices:update", "payments:create", "payments:read", "payments:update", "reports:read", "members:read", "memberships:read"]);

  if (rolePermEntries.length > 0) {
    await db.insert(rolePermissionsTable).values(rolePermEntries).onConflictDoNothing();
  }
  console.log(`✓ Role permissions mapped`);

  // Staff users
  const staffData = [
    { email: "admin@aurafitness.dz", password: "Admin@2024!", firstName: "Ahmed", lastName: "Benali", roleName: "super_admin" },
    { email: "manager@aurafitness.dz", password: "Manager@2024!", firstName: "Karim", lastName: "Meziane", roleName: "manager" },
    { email: "reception@aurafitness.dz", password: "Reception@2024!", firstName: "Sara", lastName: "Hamidi", roleName: "reception" },
    { email: "trainer@aurafitness.dz", password: "Trainer@2024!", firstName: "Yacine", lastName: "Boudiaf", roleName: "trainer" },
  ];

  const users = [];
  for (const s of staffData) {
    const [user] = await db
      .insert(usersTable)
      .values({ email: s.email, passwordHash: await hashPassword(s.password), firstName: s.firstName, lastName: s.lastName, roleId: roleMap[s.roleName] })
      .onConflictDoNothing()
      .returning();
    if (user) users.push(user);
  }
  console.log(`✓ ${users.length} staff users`);

  const adminId = users.find((u) => u.email === "admin@aurafitness.dz")?.id ?? users[0]?.id;
  const trainerId = users.find((u) => u.email === "trainer@aurafitness.dz")?.id;

  // Plans
  const plansData = [
    { name: "Monthly Basic", nameAr: "الاشتراك الشهري الأساسي", price: "2500.00", durationDays: 30, maxFreezeDays: 3, features: ["gym_access", "locker"] },
    { name: "Monthly Premium", nameAr: "الاشتراك الشهري المميز", price: "4000.00", durationDays: 30, maxFreezeDays: 7, features: ["gym_access", "classes", "locker", "towel"] },
    { name: "Quarterly", nameAr: "الاشتراك الفصلي", price: "9000.00", durationDays: 90, maxFreezeDays: 14, features: ["gym_access", "classes", "locker", "towel", "nutrition_consult"] },
    { name: "Annual", nameAr: "الاشتراك السنوي", price: "28000.00", durationDays: 365, maxFreezeDays: 30, features: ["gym_access", "classes", "locker", "towel", "nutrition_consult", "personal_training_2x"] },
    { name: "Women Only Monthly", nameAr: "اشتراك نسائي شهري", price: "2200.00", durationDays: 30, maxFreezeDays: 5, timeRestrictions: { startTime: "07:00", endTime: "22:00", genderRestriction: "female" }, features: ["gym_access", "classes", "locker"] },
  ];

  const plans = await db.insert(plansTable).values(plansData.map((p) => ({ ...p, allowedZones: ["main", "cardio", "weights"], createdBy: adminId }))).onConflictDoNothing().returning();
  console.log(`✓ ${plans.length} plans`);

  // Members
  const membersData = [
    { firstName: "Mohamed", lastName: "Benamara", firstNameAr: "محمد", lastNameAr: "بن عمارة", phone: "0661234567", email: "m.benamara@email.com", gender: "male" as const },
    { firstName: "Fatima", lastName: "Cherif", firstNameAr: "فاطمة", lastNameAr: "شريف", phone: "0551234568", email: "f.cherif@email.com", gender: "female" as const },
    { firstName: "Amine", lastName: "Khelifi", firstNameAr: "أمين", lastNameAr: "خليفي", phone: "0771234569", email: "a.khelifi@email.com", gender: "male" as const },
    { firstName: "Nadia", lastName: "Benaissa", firstNameAr: "نادية", lastNameAr: "بن عيسى", phone: "0551234570", email: "n.benaissa@email.com", gender: "female" as const },
    { firstName: "Khaled", lastName: "Bensmain", phone: "0661234571", gender: "male" as const },
    { firstName: "Amira", lastName: "Touati", phone: "0551234572", gender: "female" as const },
    { firstName: "Youssef", lastName: "Hadj", phone: "0771234573", gender: "male" as const },
    { firstName: "Meriem", lastName: "Saidani", phone: "0661234574", gender: "female" as const },
    { firstName: "Rachid", lastName: "Boukhari", phone: "0551234575", gender: "male" as const },
    { firstName: "Hanane", lastName: "Merzougui", phone: "0771234576", gender: "female" as const },
  ];

  const memberNumbers = ["AUR2401001", "AUR2401002", "AUR2401003", "AUR2401004", "AUR2401005", "AUR2401006", "AUR2401007", "AUR2401008", "AUR2401009", "AUR2401010"];
  const members = await db
    .insert(membersTable)
    .values(membersData.map((m, i) => ({ ...m, memberNumber: memberNumbers[i], createdBy: adminId })))
    .onConflictDoNothing()
    .returning();
  console.log(`✓ ${members.length} members`);

  if (members.length === 0) {
    console.log("Seed already run. Skipping remaining steps.");
    process.exit(0);
  }

  // Memberships — assign plans to members
  const now = new Date();
  const membershipsData = members.slice(0, 8).map((m, i) => {
    const plan = plans[i % plans.length];
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 20));
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.durationDays);
    const isExpired = endDate < now;
    return {
      memberId: m.id,
      planId: plan.id,
      status: (isExpired ? "expired" : "active") as any,
      startDate,
      endDate,
      createdBy: adminId,
    };
  });

  const memberships = await db.insert(membershipsTable).values(membershipsData).onConflictDoNothing().returning();
  console.log(`✓ ${memberships.length} memberships`);

  // Invoices + Payments
  let invoiceNum = 1;
  for (const membership of memberships.slice(0, 6)) {
    const member = members.find((m) => m.id === membership.memberId)!;
    const plan = plans.find((p) => p.id === membership.planId)!;
    const invoiceNumber = `INV-2024-${String(invoiceNum++).padStart(4, "0")}`;
    const [invoice] = await db
      .insert(invoicesTable)
      .values({ invoiceNumber, memberId: member.id, membershipId: membership.id, subtotal: plan.price, total: plan.price, status: "paid", paidAt: membership.startDate, createdBy: adminId })
      .returning();
    await db.insert(invoiceItemsTable).values({ invoiceId: invoice.id, description: `${plan.name} - ${plan.durationDays} days`, quantity: 1, unitPrice: plan.price, total: plan.price });
    await db.insert(paymentsTable).values({ invoiceId: invoice.id, memberId: member.id, amount: plan.price, method: invoiceNum % 2 === 0 ? "baridimob" : "cash", status: "confirmed", confirmedBy: adminId, confirmedAt: membership.startDate, recordedBy: adminId });
  }
  console.log(`✓ Invoices and payments`);

  // Access Points
  const accessPoints = await db
    .insert(accessPointsTable)
    .values([
      { name: "Main Entrance", location: "Front door", zone: "main", type: "entry", hardwareId: "HW-MAIN-001" },
      { name: "Exit Gate", location: "Back door", zone: "main", type: "exit", hardwareId: "HW-EXIT-001" },
      { name: "Weight Room", location: "2nd floor", zone: "weights", type: "entry" },
      { name: "Cardio Zone", location: "Ground floor", zone: "cardio", type: "entry" },
    ])
    .onConflictDoNothing()
    .returning();
  console.log(`✓ ${accessPoints.length} access points`);

  // Time Rules
  await db.insert(timeRulesTable).values([
    { name: "Women-Only Morning", description: "Morning women-only session", allowedGender: "female", startTime: "07:00", endTime: "10:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
    { name: "Women-Only Afternoon", description: "Afternoon women-only session", allowedGender: "female", startTime: "13:00", endTime: "16:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
  ]).onConflictDoNothing();
  console.log(`✓ Time rules`);

  // Access Logs
  const accessLogsData = [];
  for (let i = 0; i < 50; i++) {
    const member = members[Math.floor(Math.random() * members.length)];
    const point = accessPoints[0];
    const logDate = new Date(now);
    logDate.setDate(logDate.getDate() - Math.floor(Math.random() * 14));
    logDate.setHours(8 + Math.floor(Math.random() * 12));
    accessLogsData.push({ memberId: member.id, accessPointId: point.id, result: Math.random() > 0.1 ? "allowed" as const : "denied" as const, denialReason: Math.random() > 0.1 ? null : "membership_expired", verifiedVia: "qr", createdAt: logDate });
  }
  await db.insert(accessLogsTable).values(accessLogsData);
  console.log(`✓ 50 access log entries`);

  // Class Types
  const classTypes = await db
    .insert(classTypesTable)
    .values([
      { name: "CrossFit", nameAr: "كروس فت", description: "High-intensity functional training", durationMinutes: 60, maxCapacity: 15, difficultyLevel: "advanced", defaultTrainerId: trainerId, color: "#ef4444" },
      { name: "Yoga", nameAr: "يوغا", description: "Mind-body balance and flexibility", durationMinutes: 60, maxCapacity: 20, difficultyLevel: "beginner", color: "#8b5cf6" },
      { name: "Boxing", nameAr: "ملاكمة", description: "Boxing fundamentals and fitness", durationMinutes: 90, maxCapacity: 12, difficultyLevel: "intermediate", defaultTrainerId: trainerId, color: "#f97316" },
      { name: "Spinning", nameAr: "دراجة ثابتة", description: "Indoor cycling cardio session", durationMinutes: 45, maxCapacity: 25, difficultyLevel: "all", color: "#06b6d4" },
    ])
    .onConflictDoNothing()
    .returning();
  console.log(`✓ ${classTypes.length} class types`);

  // Class Sessions (next 7 days)
  const sessionsData = [];
  for (let day = 0; day < 7; day++) {
    const sessionDate = new Date(now);
    sessionDate.setDate(sessionDate.getDate() + day);
    for (const classType of classTypes) {
      const start = new Date(sessionDate);
      start.setHours(day % 2 === 0 ? 9 : 17, 0, 0, 0);
      const end = new Date(start.getTime() + classType.durationMinutes * 60000);
      sessionsData.push({ classTypeId: classType.id, trainerId, room: `Room ${classTypes.indexOf(classType) + 1}`, startsAt: start, endsAt: end, maxCapacity: classType.maxCapacity, createdBy: adminId });
    }
  }
  const sessions = await db.insert(classSessionsTable).values(sessionsData).onConflictDoNothing().returning();
  console.log(`✓ ${sessions.length} class sessions`);

  // Bookings
  const bookingsData = [];
  for (const session of sessions.slice(0, 20)) {
    const numBookings = Math.floor(Math.random() * Math.min(5, session.maxCapacity ?? 10));
    for (let i = 0; i < numBookings; i++) {
      const member = members[i % members.length];
      bookingsData.push({ memberId: member.id, sessionId: session.id, status: "confirmed" as const });
    }
  }
  if (bookingsData.length > 0) {
    await db.insert(bookingsTable).values(bookingsData).onConflictDoNothing();
    for (const session of sessions.slice(0, 20)) {
      const count = bookingsData.filter((b) => b.sessionId === session.id).length;
      if (count > 0) await db.update(classSessionsTable).set({ currentBookings: count }).where(eq(classSessionsTable.id, session.id));
    }
  }
  console.log(`✓ ${bookingsData.length} bookings`);

  // Products
  const products = await db
    .insert(productsTable)
    .values([
      { name: "Whey Protein 1kg", nameAr: "بروتين مصل اللبن 1كغ", category: "supplements", salePrice: "3500.00", purchasePrice: "2200.00", stockQuantity: 25, lowStockThreshold: 5, createdBy: adminId },
      { name: "Creatine 300g", nameAr: "كرياتين 300غ", category: "supplements", salePrice: "1800.00", purchasePrice: "1100.00", stockQuantity: 15, lowStockThreshold: 3, createdBy: adminId },
      { name: "Water Bottle 750ml", nameAr: "قارورة ماء 750مل", category: "accessories", salePrice: "350.00", purchasePrice: "150.00", stockQuantity: 50, lowStockThreshold: 10, createdBy: adminId },
      { name: "AURA Training T-Shirt", nameAr: "تي شيرت AURA للتدريب", category: "clothing", salePrice: "1500.00", purchasePrice: "800.00", stockQuantity: 30, lowStockThreshold: 5, createdBy: adminId },
      { name: "Energy Drink 250ml", nameAr: "مشروب طاقة 250مل", category: "drinks", salePrice: "200.00", purchasePrice: "90.00", stockQuantity: 60, lowStockThreshold: 15, createdBy: adminId },
      { name: "Resistance Band Set", nameAr: "مجموعة أشرطة مقاومة", category: "equipment", salePrice: "1200.00", purchasePrice: "600.00", stockQuantity: 20, lowStockThreshold: 5, createdBy: adminId },
    ])
    .onConflictDoNothing()
    .returning();
  console.log(`✓ ${products.length} products`);

  // Notification Templates
  await db
    .insert(notificationTemplatesTable)
    .values([
      { key: "membership_expiry_7d", eventTrigger: "membership.expiring_soon", titleAr: "اشتراكك ينتهي قريباً", titleFr: "Votre abonnement expire bientôt", bodyAr: "اشتراكك ينتهي خلال 7 أيام. جدد الآن لتجنب الانقطاع.", bodyFr: "Votre abonnement expire dans 7 jours. Renouvelez maintenant pour éviter toute interruption.", channels: ["push"] },
      { key: "booking_confirmed", eventTrigger: "booking.confirmed", titleAr: "تم تأكيد حجزك", titleFr: "Réservation confirmée", bodyAr: "تم تأكيد حجزك للحصة. نراك قريباً!", bodyFr: "Votre réservation a été confirmée. À bientôt!", channels: ["push"] },
      { key: "payment_confirmed", eventTrigger: "payment.confirmed", titleAr: "تم تأكيد دفعتك", titleFr: "Paiement confirmé", bodyAr: "تم استلام دفعتك بنجاح. شكراً لك!", bodyFr: "Votre paiement a été reçu avec succès. Merci!", channels: ["push"] },
      { key: "welcome", eventTrigger: "member.created", titleAr: "مرحباً بك في AURA!", titleFr: "Bienvenue chez AURA!", bodyAr: "مرحباً بك في نادي AURA للياقة البدنية. نتمنى لك تجربة رائعة!", bodyFr: "Bienvenue au club AURA Fitness. Nous vous souhaitons une excellente expérience!", channels: ["push"] },
      { key: "access_denied", eventTrigger: "access.denied", titleAr: "محاولة دخول مرفوضة", titleFr: "Accès refusé", bodyAr: "تم رفض محاولة الدخول. يرجى التواصل مع الاستقبال.", bodyFr: "Tentative d'accès refusée. Veuillez contacter la réception.", channels: ["push"] },
    ])
    .onConflictDoNothing();
  console.log(`✓ Notification templates`);

  // System Config
  await db
    .insert(systemConfigTable)
    .values([
      { key: "club_name", value: "AURA Fitness Club", category: "general" },
      { key: "club_name_ar", value: "نادي AURA للياقة البدنية", category: "general" },
      { key: "club_phone", value: "+213 555 123 456", category: "general" },
      { key: "club_email", value: "contact@aurafitness.dz", category: "general" },
      { key: "club_address", value: "123 Rue de la République, Alger", category: "general" },
      { key: "currency", value: "DZD", category: "billing" },
      { key: "timezone", value: "Africa/Algiers", category: "general" },
      { key: "default_language", value: "ar", category: "general" },
    ])
    .onConflictDoNothing()
    .returning();

  // Business Rules
  await db
    .insert(businessRulesTable)
    .values([
      { key: "max_freeze_days_default", value: "7", description: "Default maximum freeze days per membership", category: "memberships" },
      { key: "booking_cancellation_hours", value: "24", description: "Minimum hours before class to cancel for free", category: "classes" },
      { key: "max_no_show_per_month", value: "3", description: "Maximum no-shows before booking is restricted", category: "classes" },
      { key: "cash_reconciliation_threshold", value: "500", description: "Alert threshold for cash reconciliation difference (DZD)", category: "billing" },
      { key: "qr_token_validity_seconds", value: "90", description: "QR access token validity in seconds", category: "access" },
      { key: "waitlist_notification_minutes", value: "10", description: "Minutes member has to confirm from waitlist", category: "classes" },
      { key: "expiry_warning_days", value: "7", description: "Days before expiry to send warning notification", category: "memberships" },
    ])
    .onConflictDoNothing();

  console.log(`✓ System config and business rules`);

  // Member Timeline Events
  for (const member of members.slice(0, 5)) {
    await db.insert(memberTimelineEventsTable).values([
      { memberId: member.id, eventType: "member_created", description: "Member profile created", actorId: adminId },
      { memberId: member.id, eventType: "membership_created", description: "Initial membership assigned", actorId: adminId },
    ]);
  }

  console.log("✅ Seed complete!");
  console.log("\n📋 Demo accounts:");
  for (const s of staffData) {
    console.log(`   ${s.roleName.padEnd(12)} — ${s.email} / ${s.password}`);
  }
}

seed()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
