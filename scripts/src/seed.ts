import { db } from "@workspace/db";
import {
  rolesTable,
  permissionsTable,
  rolePermissionsTable,
  usersTable,
  refreshTokensTable,
  membersTable,
  memberTimelineEventsTable,
  plansTable,
  membershipsTable,
  membershipFreezeRequestsTable,
  invoicesTable,
  invoiceItemsTable,
  paymentsTable,
  discountsTable,
  cashReconciliationsTable,
  accessPointsTable,
  accessTokensTable,
  accessLogsTable,
  timeRulesTable,
  classTypesTable,
  classSessionsTable,
  bookingsTable,
  waitlistEntriesTable,
  productsTable,
  inventoryTransactionsTable,
  posSessionsTable,
  ordersTable,
  orderItemsTable,
  notificationTemplatesTable,
  notificationRecordsTable,
  pointsRulesTable,
  rewardsTable,
  memberPointsLedgerTable,
  auditLogsTable,
  systemConfigTable,
  businessRulesTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  console.log("🌱 Starting AURA Fitness full seed...");
  console.log("🗑️  Clearing existing data...");

  await db.execute(sql`
    TRUNCATE TABLE
      challenges,
      member_points_ledger,
      notification_records,
      waitlist_entries,
      bookings,
      access_logs,
      access_tokens,
      audit_logs,
      member_timeline_events,
      membership_freeze_requests,
      cash_reconciliations,
      order_items,
      orders,
      inventory_transactions,
      pos_sessions,
      payments,
      invoice_items,
      invoices,
      discounts,
      class_sessions,
      memberships,
      refresh_tokens,
      members,
      products,
      users,
      class_types,
      time_rules,
      access_points,
      notification_templates,
      points_rules,
      rewards,
      role_permissions,
      permissions,
      roles,
      plans,
      system_config,
      business_rules
    RESTART IDENTITY CASCADE
  `);
  console.log("✓ Cleared all data");

  // ── ROLES ────────────────────────────────────────────────────────────────
  const roles = await db
    .insert(rolesTable)
    .values([
      { name: "super_admin", description: "Full system access" },
      { name: "manager", description: "Club manager — full operational access" },
      { name: "reception", description: "Front desk staff" },
      { name: "trainer", description: "Fitness trainer" },
      { name: "accountant", description: "Billing and finance access" },
    ])
    .returning();
  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r.id]));
  console.log(`✓ ${roles.length} roles`);

  // ── PERMISSIONS ───────────────────────────────────────────────────────────
  const resources = [
    "members", "plans", "memberships", "invoices", "payments",
    "access", "classes", "staff", "store", "reports", "settings",
    "audit_logs", "discounts", "notifications",
  ];
  const actions = ["create", "read", "update", "delete"];
  const permValues = resources.flatMap((r) =>
    actions.map((a) => ({ resource: r, action: a })),
  );
  const perms = await db.insert(permissionsTable).values(permValues).returning();
  const permMap: Record<string, string> = {};
  for (const p of perms) permMap[`${p.resource}:${p.action}`] = p.id;
  console.log(`✓ ${perms.length} permissions`);

  const rolePermEntries: Array<{ roleId: string; permissionId: string }> = [];
  const addPerms = (roleName: string, pairs: string[]) => {
    for (const key of pairs) {
      if (roleMap[roleName] && permMap[key]) {
        rolePermEntries.push({
          roleId: roleMap[roleName],
          permissionId: permMap[key],
        });
      }
    }
  };

  const allPerms = resources.flatMap((r) => actions.map((a) => `${r}:${a}`));
  addPerms("super_admin", allPerms);
  addPerms("manager", allPerms.filter((p) => p !== "settings:delete"));
  addPerms("reception", [
    "members:create", "members:read", "members:update",
    "invoices:read", "payments:create", "payments:read",
    "access:read", "classes:read", "memberships:read", "discounts:read",
  ]);
  addPerms("trainer", [
    "members:read", "classes:read", "classes:update", "access:read",
  ]);
  addPerms("accountant", [
    "invoices:create", "invoices:read", "invoices:update",
    "payments:create", "payments:read", "payments:update",
    "reports:read", "members:read", "memberships:read",
    "discounts:create", "discounts:read",
  ]);

  await db.insert(rolePermissionsTable).values(rolePermEntries);
  console.log(`✓ Role permissions mapped`);

  // ── STAFF USERS ───────────────────────────────────────────────────────────
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
      .values({
        email: s.email,
        passwordHash: await hashPassword(s.password),
        firstName: s.firstName,
        lastName: s.lastName,
        roleId: roleMap[s.roleName],
      })
      .returning();
    users.push(user);
  }
  console.log(`✓ ${users.length} staff users`);

  const adminId = users.find((u) => u.email === "admin@aurafitness.dz")!.id;
  const managerId = users.find((u) => u.email === "manager@aurafitness.dz")!.id;
  const receptionId = users.find((u) => u.email === "reception@aurafitness.dz")!.id;
  const trainerId = users.find((u) => u.email === "trainer@aurafitness.dz")!.id;

  // ── PLANS ─────────────────────────────────────────────────────────────────
  const plans = await db
    .insert(plansTable)
    .values([
      {
        name: "Basic Monthly",
        nameAr: "الاشتراك الشهري الأساسي",
        description: "Accès salle de sport — entrée principale et cardio",
        price: "1500.00",
        durationDays: 30,
        allowedZones: ["main", "cardio"],
        maxFreezeDays: 3,
        features: ["gym_access", "locker"],
        createdBy: adminId,
      },
      {
        name: "Standard Monthly",
        nameAr: "الاشتراك الشهري العادي",
        description: "Accès complet + cours collectifs",
        price: "2500.00",
        durationDays: 30,
        allowedZones: ["main", "cardio", "weights"],
        maxFreezeDays: 5,
        features: ["gym_access", "classes", "locker"],
        createdBy: adminId,
      },
      {
        name: "Premium Monthly",
        nameAr: "الاشتراك الشهري المميز",
        description: "Accès total + cours + serviette + conseil nutrition",
        price: "3500.00",
        durationDays: 30,
        allowedZones: ["main", "cardio", "weights", "pool"],
        maxFreezeDays: 7,
        storeDiscountPercent: "10.00",
        features: ["gym_access", "classes", "locker", "towel", "nutrition_consult"],
        createdBy: adminId,
      },
      {
        name: "VIP Monthly",
        nameAr: "اشتراك VIP الشهري",
        description: "Accès prioritaire + coaching personnel + toutes zones",
        price: "5000.00",
        durationDays: 30,
        allowedZones: ["main", "cardio", "weights", "pool", "vip"],
        maxFreezeDays: 14,
        storeDiscountPercent: "15.00",
        features: ["gym_access", "classes", "locker", "towel", "nutrition_consult", "personal_training_2x", "priority_booking"],
        createdBy: adminId,
      },
      {
        name: "Women's Monthly",
        nameAr: "الاشتراك النسائي الشهري",
        description: "Espace dédié aux femmes — horaires réservés",
        price: "2200.00",
        durationDays: 30,
        allowedZones: ["main", "cardio"],
        maxFreezeDays: 5,
        timeRestrictions: { genderRestriction: "female" },
        features: ["gym_access", "classes", "locker"],
        createdBy: adminId,
      },
    ])
    .returning();
  console.log(`✓ ${plans.length} plans`);

  // ── ACCESS POINTS ─────────────────────────────────────────────────────────
  const accessPoints = await db
    .insert(accessPointsTable)
    .values([
      { name: "Main Entrance", location: "Front door", zone: "main", type: "entry", hardwareId: "HW-MAIN-001" },
      { name: "Exit Gate", location: "Back door", zone: "main", type: "exit", hardwareId: "HW-EXIT-001" },
      { name: "Weight Room", location: "2nd floor", zone: "weights", type: "entry", hardwareId: "HW-WGTS-001" },
      { name: "Cardio Zone", location: "Ground floor", zone: "cardio", type: "entry", hardwareId: "HW-CARD-001" },
      { name: "Pool Access", location: "Basement", zone: "pool", type: "entry", hardwareId: "HW-POOL-001" },
    ])
    .returning();
  console.log(`✓ ${accessPoints.length} access points`);

  // ── TIME RULES ────────────────────────────────────────────────────────────
  await db.insert(timeRulesTable).values([
    {
      name: "Women-Only Morning",
      description: "Morning women-only session 07:00–10:00",
      allowedGender: "female",
      startTime: "07:00",
      endTime: "10:00",
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      zone: "main",
    },
    {
      name: "Women-Only Afternoon",
      description: "Afternoon women-only session 13:00–16:00",
      allowedGender: "female",
      startTime: "13:00",
      endTime: "16:00",
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      zone: "main",
    },
  ]);
  console.log(`✓ Time rules`);

  // ── NOTIFICATION TEMPLATES ────────────────────────────────────────────────
  await db.insert(notificationTemplatesTable).values([
    {
      key: "membership_expiry_3d",
      eventTrigger: "membership.expiring_3days",
      titleAr: "اشتراكك ينتهي بعد 3 أيام",
      titleFr: "Votre abonnement expire dans 3 jours",
      bodyAr: "عزيزي العضو، اشتراكك ينتهي في {{endDate}}. جدد الآن لتجنب الانقطاع!",
      bodyFr: "Cher membre, votre abonnement expire le {{endDate}}. Renouvelez maintenant pour éviter toute interruption!",
      channels: ["push", "sms"],
    },
    {
      key: "membership_expiry_1d",
      eventTrigger: "membership.expiring_1day",
      titleAr: "اشتراكك ينتهي غداً",
      titleFr: "Votre abonnement expire demain",
      bodyAr: "لا تنسَ! اشتراكك ينتهي غداً {{endDate}}. جدد الآن.",
      bodyFr: "N'oubliez pas! Votre abonnement expire demain {{endDate}}. Renouvelez maintenant.",
      channels: ["push", "sms"],
    },
    {
      key: "membership_expired",
      eventTrigger: "membership.expired",
      titleAr: "انتهت صلاحية اشتراكك",
      titleFr: "Votre abonnement a expiré",
      bodyAr: "انتهت صلاحية اشتراكك. تواصل مع الاستقبال لتجديده والاستمرار في التدريب.",
      bodyFr: "Votre abonnement a expiré. Contactez la réception pour le renouveler et continuer votre entraînement.",
      channels: ["push"],
    },
    {
      key: "payment_confirmed",
      eventTrigger: "payment.confirmed",
      titleAr: "تم تأكيد دفعتك ✓",
      titleFr: "Paiement confirmé ✓",
      bodyAr: "تم استلام دفعتك بمبلغ {{amount}} دج بنجاح. شكراً لك!",
      bodyFr: "Votre paiement de {{amount}} DA a été reçu avec succès. Merci!",
      channels: ["push"],
    },
    {
      key: "payment_rejected",
      eventTrigger: "payment.rejected",
      titleAr: "تم رفض دفعتك",
      titleFr: "Paiement rejeté",
      bodyAr: "تم رفض دفعتك. السبب: {{reason}}. يرجى التواصل مع الاستقبال.",
      bodyFr: "Votre paiement a été rejeté. Raison: {{reason}}. Veuillez contacter la réception.",
      channels: ["push", "sms"],
    },
    {
      key: "booking_confirmed",
      eventTrigger: "booking.confirmed",
      titleAr: "تم تأكيد حجزك",
      titleFr: "Réservation confirmée",
      bodyAr: "تم تأكيد حجزك في حصة {{className}} يوم {{date}} الساعة {{time}}. نراك قريباً!",
      bodyFr: "Votre réservation pour {{className}} le {{date}} à {{time}} est confirmée. À bientôt!",
      channels: ["push"],
    },
    {
      key: "booking_cancelled",
      eventTrigger: "booking.cancelled",
      titleAr: "تم إلغاء حجزك",
      titleFr: "Réservation annulée",
      bodyAr: "تم إلغاء حجزك في حصة {{className}}. يمكنك الحجز لحصة أخرى.",
      bodyFr: "Votre réservation pour {{className}} a été annulée. Vous pouvez réserver une autre séance.",
      channels: ["push"],
    },
    {
      key: "waitlist_promoted",
      eventTrigger: "waitlist.promoted",
      titleAr: "مكان متاح في الحصة!",
      titleFr: "Place disponible!",
      bodyAr: "تهانينا! أصبح لديك مكان في حصة {{className}} يوم {{date}}. لديك 10 دقائق للتأكيد.",
      bodyFr: "Félicitations! Une place est disponible pour {{className}} le {{date}}. Vous avez 10 minutes pour confirmer.",
      channels: ["push", "sms"],
    },
    {
      key: "freeze_approved",
      eventTrigger: "membership.frozen",
      titleAr: "تم تجميد اشتراكك",
      titleFr: "Abonnement gelé",
      bodyAr: "تم تجميد اشتراكك حتى {{freezeEnd}}. سيستأنف تلقائياً عند انتهاء فترة التجميد.",
      bodyFr: "Votre abonnement a été gelé jusqu'au {{freezeEnd}}. Il reprendra automatiquement à la fin de la période de gel.",
      channels: ["push"],
    },
    {
      key: "welcome",
      eventTrigger: "member.created",
      titleAr: "مرحباً بك في AURA! 🎉",
      titleFr: "Bienvenue chez AURA! 🎉",
      bodyAr: "مرحباً {{firstName}}! نرحب بك في عائلة AURA للياقة البدنية. رقم عضويتك: {{memberNumber}}.",
      bodyFr: "Bonjour {{firstName}}! Bienvenue dans la famille AURA Fitness. Votre numéro de membre: {{memberNumber}}.",
      channels: ["push", "sms"],
    },
  ]);
  console.log(`✓ 10 notification templates`);

  // ── POINTS RULES ──────────────────────────────────────────────────────────
  await db.insert(pointsRulesTable).values([
    { eventType: "membership_renewal", points: 100, description: "Points gagnés à chaque renouvellement d'abonnement" },
    { eventType: "class_attended", points: 20, description: "Points gagnés pour chaque cours suivi" },
    { eventType: "store_purchase", points: 10, description: "Points pour chaque 1000 DZD dépensés en boutique" },
    { eventType: "referral", points: 200, description: "Points pour avoir parrainé un nouveau membre" },
    { eventType: "birthday", points: 50, description: "Points offerts le jour d'anniversaire" },
  ]);

  // ── REWARDS ───────────────────────────────────────────────────────────────
  await db.insert(rewardsTable).values([
    { name: "Free Month Extension", nameAr: "تمديد شهر مجاني", description: "1 month added to your membership", pointsCost: 500, stock: 10 },
    { name: "Free Class Session", nameAr: "حصة مجانية", description: "One free group class", pointsCost: 100, stock: 50 },
    { name: "Store Voucher 500 DZD", nameAr: "قسيمة شراء 500 دج", description: "500 DZD store credit", pointsCost: 200, stock: 30 },
    { name: "Personal Training Session", nameAr: "جلسة تدريب شخصي", description: "1 hour with a personal trainer", pointsCost: 300, stock: 20 },
  ]);
  console.log(`✓ Points rules & rewards`);

  // ── DISCOUNT CODES ────────────────────────────────────────────────────────
  await db.insert(discountsTable).values([
    { code: "WELCOME10", type: "percent", value: "10.00", description: "10% réduction pour nouveaux membres", maxUses: 100, usesCount: 23, createdBy: adminId },
    { code: "RAMADAN25", type: "percent", value: "25.00", description: "Promotion Ramadan", maxUses: 50, usesCount: 48, validFrom: daysAgo(15), validUntil: daysFromNow(5), createdBy: adminId },
    { code: "SUMMER500", type: "fixed", value: "500.00", description: "Réduction été — 500 DZD", maxUses: 200, usesCount: 67, createdBy: adminId },
    { code: "VIP2024", type: "percent", value: "15.00", description: "Offre VIP exclusive", maxUses: 20, usesCount: 5, createdBy: adminId },
    { code: "RENEW20", type: "percent", value: "20.00", description: "20% de réduction sur le renouvellement", maxUses: null, usesCount: 12, createdBy: adminId },
  ]);
  console.log(`✓ Discount codes`);

  // ── 50 MEMBERS ────────────────────────────────────────────────────────────
  const maleFirstNames = ["Mohammed","Ahmed","Youcef","Khaled","Omar","Amine","Karim","Walid","Mehdi","Riadh","Tarek","Bilal","Hamza","Nassim","Sami","Djamel","Farid","Rachid","Salim","Sofiane","Hakim","Mounir","Samir","Nawfel","Redha"];
  const femaleFirstNames = ["Fatima","Amina","Sarah","Nadia","Yasmine","Samira","Rania","Asma","Leila","Meriem","Houda","Sonia","Siham","Chaima","Dalila","Karima","Lamia","Nabila","Sabrina","Zahra","Imane","Hanane","Warda","Nawel","Lydia"];
  const maleFirstNamesAr = ["محمد","أحمد","يوسف","خالد","عمر","أمين","كريم","وليد","مهدي","رياض","طارق","بلال","حمزة","ناصيم","سامي","جمال","فريد","رشيد","سليم","سفيان","حكيم","منير","سمير","نوفل","رضا"];
  const femaleFirstNamesAr = ["فاطمة","أمينة","سارة","نادية","ياسمين","سميرة","رانية","أسماء","ليلى","مريم","هدى","سونيا","سهام","شيماء","دليلة","كريمة","لمياء","نبيلة","صبرينة","زهرة","إيمان","حنان","وردة","نوال","ليديا"];
  const lastNames = ["Benali","Boumediene","Mansouri","Khelif","Meziane","Zerrouk","Hammoud","Brahimi","Senoussi","Ramdani","Ziani","Madani","Aouadi","Bensalem","Bekrar","Amrani","Khaldi","Ladjadj","Chekroun","Boudaoud","Tebboune","Guerroudj","Boukhalfa","Medjdoub","Benouaret"];
  const lastNamesAr = ["بن علي","بومدين","منصوري","خليف","مزيان","زروق","حمود","براهيمي","سنوسي","رمضاني","زياني","مداني","عواجي","بن سالم","بكرار","عمراني","خالدي","الأدجج","شكرون","بوداود","تبون","قرودج","بوخلفة","معجدوب","بنورة"];
  const wilayas = ["Alger","Oran","Constantine","Annaba","Blida","Sétif","Tlemcen","Bejaia","Tizi Ouzou","Bordj Bou Arreridj"];

  const membersData = [];
  for (let i = 0; i < 25; i++) {
    const ln = lastNames[i];
    const lnAr = lastNamesAr[i];
    membersData.push({
      firstName: maleFirstNames[i],
      lastName: ln,
      firstNameAr: maleFirstNamesAr[i],
      lastNameAr: lnAr,
      gender: "male" as const,
      phone: `+213 5${String(50 + i).padStart(2,"0")} ${String(100000 + i).slice(0,3)} ${String(100000 + i).slice(3,6)}`,
      email: `${maleFirstNames[i].toLowerCase()}.${ln.toLowerCase()}@gmail.com`,
      memberNumber: `AUR2401${String(i + 1).padStart(3, "0")}`,
      city: pick(wilayas),
      createdBy: adminId,
      createdAt: daysAgo(randomInt(30, 365)),
    });
  }
  for (let i = 0; i < 25; i++) {
    const ln = lastNames[i];
    const lnAr = lastNamesAr[i];
    membersData.push({
      firstName: femaleFirstNames[i],
      lastName: ln,
      firstNameAr: femaleFirstNamesAr[i],
      lastNameAr: lnAr,
      gender: "female" as const,
      phone: `+213 6${String(60 + i).padStart(2,"0")} ${String(200000 + i).slice(0,3)} ${String(200000 + i).slice(3,6)}`,
      email: `${femaleFirstNames[i].toLowerCase()}.${ln.toLowerCase()}2@gmail.com`,
      memberNumber: `AUR2401${String(i + 26).padStart(3, "0")}`,
      city: pick(wilayas),
      createdBy: adminId,
      createdAt: daysAgo(randomInt(30, 365)),
    });
  }

  const members = await db.insert(membersTable).values(membersData).returning();
  console.log(`✓ ${members.length} members`);

  // ── MEMBERSHIPS ───────────────────────────────────────────────────────────
  const membershipsData = members.map((m, i) => {
    const plan = plans[i % plans.length];
    let status: "active" | "frozen" | "expired" | "cancelled" = "active";
    let startDate: Date;
    let endDate: Date;

    if (i < 35) {
      // Active — started 1-20 days ago, ending in future
      startDate = daysAgo(randomInt(1, 20));
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + plan.durationDays);
      if (endDate < new Date()) {
        endDate = daysFromNow(randomInt(5, 25));
      }
      status = "active";
    } else if (i < 40) {
      // Frozen
      startDate = daysAgo(randomInt(10, 25));
      endDate = daysFromNow(randomInt(15, 35));
      status = "frozen";
    } else if (i < 45) {
      // Expired — ended in the past
      startDate = daysAgo(randomInt(40, 90));
      endDate = daysAgo(randomInt(5, 30));
      status = "expired";
    } else {
      // Cancelled
      startDate = daysAgo(randomInt(30, 60));
      endDate = daysFromNow(randomInt(5, 20));
      status = "cancelled";
    }

    return {
      memberId: m.id,
      planId: plan.id,
      status,
      startDate,
      endDate,
      freezeStart: status === "frozen" ? daysAgo(randomInt(1, 5)) : null,
      freezeEnd: status === "frozen" ? daysFromNow(randomInt(5, 14)) : null,
      freezeReason: status === "frozen" ? pick(["Voyage", "Maladie", "Ramadan", "Voyage professionnel"]) : null,
      cancelledAt: status === "cancelled" ? daysAgo(randomInt(1, 10)) : null,
      cancelledBy: status === "cancelled" ? adminId : null,
      cancellationReason: status === "cancelled" ? pick(["Déménagement", "Raisons personnelles", "Insatisfaction", "Financier"]) : null,
      createdBy: adminId,
    };
  });

  const memberships = await db.insert(membershipsTable).values(membershipsData).returning();
  console.log(`✓ ${memberships.length} memberships`);

  // ── TIMELINE EVENTS ───────────────────────────────────────────────────────
  const timelineEvents = [];
  for (const member of members.slice(0, 20)) {
    timelineEvents.push(
      { memberId: member.id, eventType: "member_created", description: "Profil membre créé", actorId: adminId },
      { memberId: member.id, eventType: "membership_created", description: "Abonnement initial assigné", actorId: adminId },
    );
  }
  await db.insert(memberTimelineEventsTable).values(timelineEvents);

  // ── INVOICES + PAYMENTS ───────────────────────────────────────────────────
  let invoiceCounter = 1;
  const paymentMethods = ["cash", "baridimob", "baridimob", "cib", "edahabia"] as const;

  for (let i = 0; i < Math.min(40, memberships.length); i++) {
    const membership = memberships[i];
    const member = members.find((m) => m.id === membership.memberId)!;
    const plan = plans.find((p) => p.id === membership.planId)!;
    const invoiceNumber = `INV-2024-${String(invoiceCounter++).padStart(4, "0")}`;
    const method = pick([...paymentMethods] as ("cash" | "baridimob" | "cib" | "edahabia" | "other")[]);
    const isConfirmed = method === "cash" || (i % 3 !== 0);
    const isPending = method !== "cash" && i % 3 === 0;

    const [invoice] = await db
      .insert(invoicesTable)
      .values({
        invoiceNumber,
        memberId: member.id,
        membershipId: membership.id,
        subtotal: plan.price,
        total: plan.price,
        status: isConfirmed ? "paid" : "pending",
        paidAt: isConfirmed ? membership.startDate : null,
        createdBy: adminId,
      })
      .returning();

    await db.insert(invoiceItemsTable).values({
      invoiceId: invoice.id,
      description: `${plan.name} — ${plan.durationDays} jours`,
      quantity: 1,
      unitPrice: plan.price,
      total: plan.price,
    });

    await db.insert(paymentsTable).values({
      invoiceId: invoice.id,
      memberId: member.id,
      amount: plan.price,
      method,
      status: isConfirmed ? "confirmed" : "pending",
      referenceNumber: method !== "cash" ? `REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}` : null,
      confirmedBy: isConfirmed ? receptionId : null,
      confirmedAt: isConfirmed ? membership.startDate : null,
      recordedBy: receptionId,
    });

    if (isConfirmed) {
      await db.insert(memberTimelineEventsTable).values({
        memberId: member.id,
        eventType: "payment_confirmed",
        description: `Paiement de ${plan.price} DZD confirmé via ${method}`,
        actorId: receptionId,
      });
    }
  }
  console.log(`✓ 40 invoices + payments (includes Baridimob pending)`);

  // ── CLASS TYPES ───────────────────────────────────────────────────────────
  const classTypes = await db
    .insert(classTypesTable)
    .values([
      { name: "CrossFit", nameAr: "كروسفيت", description: "Entraînement fonctionnel haute intensité", durationMinutes: 60, maxCapacity: 15, difficultyLevel: "advanced", defaultTrainerId: trainerId, color: "#ef4444" },
      { name: "Yoga", nameAr: "يوغا", description: "Équilibre corps-esprit et flexibilité", durationMinutes: 60, maxCapacity: 20, difficultyLevel: "beginner", color: "#8b5cf6" },
      { name: "Boxing", nameAr: "ملاكمة", description: "Initiation à la boxe et remise en forme", durationMinutes: 90, maxCapacity: 12, difficultyLevel: "intermediate", defaultTrainerId: trainerId, color: "#f97316" },
      { name: "Spinning", nameAr: "دراجة ثابتة", description: "Cardio vélo en salle", durationMinutes: 45, maxCapacity: 25, difficultyLevel: "all", color: "#06b6d4" },
      { name: "Zumba", nameAr: "زومبا", description: "Danse cardio latine — tous niveaux", durationMinutes: 60, maxCapacity: 30, difficultyLevel: "beginner", color: "#ec4899" },
      { name: "HIIT", nameAr: "تدريب متقطع عالي الكثافة", description: "Intervalles haute intensité — brûle-graisse", durationMinutes: 45, maxCapacity: 20, difficultyLevel: "advanced", defaultTrainerId: trainerId, color: "#dc2626" },
      { name: "Pilates", nameAr: "بيلاتس", description: "Renforcement musculaire en douceur", durationMinutes: 60, maxCapacity: 15, difficultyLevel: "intermediate", color: "#14b8a6" },
      { name: "Stretching", nameAr: "تمارين الإطالة", description: "Récupération et mobilité articulaire", durationMinutes: 45, maxCapacity: 25, difficultyLevel: "beginner", color: "#84cc16" },
      { name: "Kickboxing", nameAr: "كيك بوكسينج", description: "Arts martiaux et cardio combinés", durationMinutes: 60, maxCapacity: 15, difficultyLevel: "intermediate", defaultTrainerId: trainerId, color: "#7c3aed" },
      { name: "Aquagym", nameAr: "الجمباز المائي", description: "Gym en piscine — faible impact", durationMinutes: 45, maxCapacity: 20, difficultyLevel: "beginner", color: "#0ea5e9" },
    ])
    .returning();
  console.log(`✓ ${classTypes.length} class types`);

  // ── CLASS SESSIONS (next 30 days + past 7 days) ───────────────────────────
  const sessionsData = [];
  const timeSlots = [
    { h: 7, m: 0 }, { h: 9, m: 0 }, { h: 11, m: 0 },
    { h: 14, m: 0 }, { h: 17, m: 0 }, { h: 19, m: 0 },
  ];
  const rooms = ["Salle A", "Salle B", "Salle C", "Studio 1", "Piscine"];

  for (let day = -7; day <= 30; day++) {
    const d = new Date();
    d.setDate(d.getDate() + day);
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 5) continue; // Friday — closed

    const slotsForDay = day < 0 ? [timeSlots[1], timeSlots[4]] : timeSlots.slice(0, 4);
    const typesForDay = classTypes.slice(0, randomInt(3, 6));

    for (let ti = 0; ti < typesForDay.length && ti < slotsForDay.length; ti++) {
      const slot = slotsForDay[ti];
      const ct = typesForDay[ti];
      const start = new Date(d);
      start.setHours(slot.h, slot.m, 0, 0);
      const end = new Date(start.getTime() + ct.durationMinutes * 60000);

      let status: "scheduled" | "ongoing" | "completed" | "cancelled" = "scheduled";
      if (day < -1) status = "completed";
      else if (day === -1 && slot.h < new Date().getHours()) status = "completed";
      else if (day === 0 && slot.h < new Date().getHours()) status = "ongoing";

      sessionsData.push({
        classTypeId: ct.id,
        trainerId,
        room: rooms[ti % rooms.length],
        startsAt: start,
        endsAt: end,
        maxCapacity: ct.maxCapacity,
        status,
        createdBy: adminId,
      });
    }
  }

  const sessions = await db.insert(classSessionsTable).values(sessionsData).returning();
  console.log(`✓ ${sessions.length} class sessions`);

  // ── BOOKINGS ──────────────────────────────────────────────────────────────
  const bookingsData = [];
  const activeMembers = members.filter((_, i) => i < 35);

  for (const session of sessions.slice(0, 80)) {
    const numBookings = randomInt(2, Math.min(8, session.maxCapacity ?? 10));
    const bookedMembers = new Set<string>();
    for (let i = 0; i < numBookings; i++) {
      const member = pick(activeMembers);
      if (bookedMembers.has(member.id)) continue;
      bookedMembers.add(member.id);
      const sessionPast = session.startsAt < new Date();
      const attended = sessionPast && Math.random() > 0.15;
      bookingsData.push({
        memberId: member.id,
        sessionId: session.id,
        status: sessionPast ? (attended ? "attended" as const : "no_show" as const) : "confirmed" as const,
        attendedAt: attended ? new Date(session.startsAt.getTime() + randomInt(0, 10) * 60000) : null,
      });
    }
    await db
      .update(classSessionsTable)
      .set({ currentBookings: bookedMembers.size })
      .where(sql`id = ${session.id}`);
  }

  if (bookingsData.length > 0) {
    await db.insert(bookingsTable).values(bookingsData);
  }
  console.log(`✓ ${bookingsData.length} bookings`);

  // ── ACCESS LOGS (realistic patterns) ─────────────────────────────────────
  const accessLogsData = [];
  const mainPoint = accessPoints[0];
  const cardioPoint = accessPoints[3];

  for (let day = 0; day < 30; day++) {
    const numEntries = randomInt(15, 40);
    for (let i = 0; i < numEntries; i++) {
      const member = pick(activeMembers);
      const point = Math.random() > 0.7 ? cardioPoint : mainPoint;
      const logDate = new Date();
      logDate.setDate(logDate.getDate() - day);
      // Peak hours: 7-10am and 5-8pm
      const peakHours = [7, 8, 9, 17, 18, 19, 20];
      const offHours = [10, 11, 12, 13, 14, 15, 16];
      const hour = Math.random() > 0.3 ? pick(peakHours) : pick(offHours);
      logDate.setHours(hour, randomInt(0, 59), 0, 0);

      const allowed = Math.random() > 0.08;
      const denialReason = allowed ? null : pick(["membership_expired", "no_active_membership", "time_rule_violation"]);

      accessLogsData.push({
        memberId: member.id,
        accessPointId: point.id,
        result: allowed ? "allowed" as const : "denied" as const,
        denialReason,
        verifiedVia: "qr",
        ipAddress: `192.168.1.${randomInt(10, 50)}`,
        createdAt: logDate,
      });
    }
  }

  await db.insert(accessLogsTable).values(accessLogsData);
  console.log(`✓ ${accessLogsData.length} access log entries`);

  // ── PRODUCTS ──────────────────────────────────────────────────────────────
  const products = await db
    .insert(productsTable)
    .values([
      { name: "Whey Protein 1kg", nameAr: "بروتين مصل اللبن 1كغ", category: "supplements", salePrice: "3500.00", purchasePrice: "2200.00", stockQuantity: 24, lowStockThreshold: 5, barcode: "6901234567890", createdBy: adminId },
      { name: "Whey Protein 2kg", nameAr: "بروتين مصل اللبن 2كغ", category: "supplements", salePrice: "6500.00", purchasePrice: "4200.00", stockQuantity: 12, lowStockThreshold: 3, barcode: "6901234567891", createdBy: adminId },
      { name: "BCAA 300g", nameAr: "BCAA 300غ", category: "supplements", salePrice: "1800.00", purchasePrice: "1100.00", stockQuantity: 18, lowStockThreshold: 5, barcode: "6901234567892", createdBy: adminId },
      { name: "Creatine 500g", nameAr: "كرياتين 500غ", category: "supplements", salePrice: "2200.00", purchasePrice: "1400.00", stockQuantity: 4, lowStockThreshold: 5, barcode: "6901234567893", createdBy: adminId },
      { name: "Pre-Workout 300g", nameAr: "مكمل ما قبل التمرين", category: "supplements", salePrice: "2800.00", purchasePrice: "1700.00", stockQuantity: 9, lowStockThreshold: 5, barcode: "6901234567894", createdBy: adminId },
      { name: "Multivitamin 90 caps", nameAr: "متعدد الفيتامينات 90 كبسولة", category: "supplements", salePrice: "1200.00", purchasePrice: "700.00", stockQuantity: 22, lowStockThreshold: 8, barcode: "6901234567895", createdBy: adminId },
      { name: "Protein Bar", nameAr: "بار بروتين", category: "supplements", salePrice: "350.00", purchasePrice: "180.00", stockQuantity: 60, lowStockThreshold: 20, barcode: "6901234567896", createdBy: adminId },
      { name: "AURA T-Shirt M", nameAr: "تي شيرت AURA مقاس M", category: "clothing", salePrice: "1200.00", purchasePrice: "600.00", stockQuantity: 15, lowStockThreshold: 5, barcode: "6901234567897", createdBy: adminId },
      { name: "AURA T-Shirt L", nameAr: "تي شيرت AURA مقاس L", category: "clothing", salePrice: "1200.00", purchasePrice: "600.00", stockQuantity: 12, lowStockThreshold: 5, barcode: "6901234567898", createdBy: adminId },
      { name: "AURA Shorts", nameAr: "شورت AURA", category: "clothing", salePrice: "1500.00", purchasePrice: "750.00", stockQuantity: 8, lowStockThreshold: 5, barcode: "6901234567899", createdBy: adminId },
      { name: "Water Bottle 750ml", nameAr: "قارورة ماء 750مل", category: "accessories", salePrice: "800.00", purchasePrice: "400.00", stockQuantity: 30, lowStockThreshold: 10, barcode: "6901234567900", createdBy: adminId },
      { name: "Gym Bag AURA", nameAr: "حقيبة رياضية AURA", category: "accessories", salePrice: "2500.00", purchasePrice: "1300.00", stockQuantity: 7, lowStockThreshold: 3, barcode: "6901234567901", createdBy: adminId },
      { name: "Lifting Gloves", nameAr: "قفازات الرفع", category: "accessories", salePrice: "1000.00", purchasePrice: "500.00", stockQuantity: 18, lowStockThreshold: 5, barcode: "6901234567902", createdBy: adminId },
      { name: "Resistance Band Set", nameAr: "مجموعة أشرطة مقاومة", category: "accessories", salePrice: "1200.00", purchasePrice: "600.00", stockQuantity: 3, lowStockThreshold: 5, barcode: "6901234567903", createdBy: adminId },
      { name: "Gym Belt", nameAr: "حزام الرفع", category: "accessories", salePrice: "1500.00", purchasePrice: "800.00", stockQuantity: 10, lowStockThreshold: 3, barcode: "6901234567904", createdBy: adminId },
      { name: "Jump Rope", nameAr: "حبل التخطي", category: "equipment", salePrice: "600.00", purchasePrice: "280.00", stockQuantity: 20, lowStockThreshold: 8, barcode: "6901234567905", createdBy: adminId },
      { name: "Yoga Mat", nameAr: "حصيرة يوغا", category: "equipment", salePrice: "1800.00", purchasePrice: "900.00", stockQuantity: 6, lowStockThreshold: 5, barcode: "6901234567906", createdBy: adminId },
      { name: "Energy Drink 250ml", nameAr: "مشروب طاقة 250مل", category: "drinks", salePrice: "250.00", purchasePrice: "100.00", stockQuantity: 80, lowStockThreshold: 20, barcode: "6901234567907", createdBy: adminId },
      { name: "Mineral Water 500ml", nameAr: "ماء معدني 500مل", category: "drinks", salePrice: "80.00", purchasePrice: "30.00", stockQuantity: 2, lowStockThreshold: 30, barcode: "6901234567908", createdBy: adminId },
      { name: "Protein Shake Ready", nameAr: "شيك بروتين جاهز", category: "drinks", salePrice: "450.00", purchasePrice: "220.00", stockQuantity: 25, lowStockThreshold: 10, barcode: "6901234567909", createdBy: adminId },
    ])
    .returning();
  console.log(`✓ ${products.length} products`);

  // ── POS SESSIONS + ORDERS ─────────────────────────────────────────────────
  let orderCounter = 1;
  for (let day = 0; day < 5; day++) {
    const openedAt = new Date();
    openedAt.setDate(openedAt.getDate() - day);
    openedAt.setHours(8, 0, 0, 0);

    const closedAt = new Date(openedAt);
    closedAt.setHours(20, 0, 0, 0);

    const openingCash = "5000.00";
    const dayRevenue = randomInt(8000, 25000);
    const closingCash = String(5000 + dayRevenue * 0.4);

    const [posSession] = await db
      .insert(posSessionsTable)
      .values({
        cashierId: receptionId,
        openedAt,
        closedAt: day > 0 ? closedAt : null,
        openingCash,
        closingCash: day > 0 ? closingCash : null,
        totalSales: String(dayRevenue),
        status: day > 0 ? "closed" : "open",
      })
      .returning();

    const numOrders = randomInt(5, 12);
    for (let o = 0; o < numOrders; o++) {
      const member = pick(activeMembers);
      const product1 = pick(products);
      const product2 = pick(products);
      const qty1 = randomInt(1, 3);
      const qty2 = randomInt(1, 2);
      const subtotal = parseFloat(product1.salePrice) * qty1 + parseFloat(product2.salePrice) * qty2;
      const orderNumber = `ORD-2024-${String(orderCounter++).padStart(5, "0")}`;

      const orderDate = new Date(openedAt);
      orderDate.setHours(randomInt(9, 19), randomInt(0, 59), 0, 0);

      const [order] = await db
        .insert(ordersTable)
        .values({
          orderNumber,
          memberId: member.id,
          posSessionId: posSession.id,
          subtotal: subtotal.toFixed(2),
          total: subtotal.toFixed(2),
          paymentMethod: pick(["cash", "cash", "baridimob", "edahabia"]),
          status: "completed",
          createdBy: receptionId,
          createdAt: orderDate,
        })
        .returning();

      await db.insert(orderItemsTable).values([
        { orderId: order.id, productId: product1.id, quantity: qty1, unitPrice: product1.salePrice, total: (parseFloat(product1.salePrice) * qty1).toFixed(2) },
        { orderId: order.id, productId: product2.id, quantity: qty2, unitPrice: product2.salePrice, total: (parseFloat(product2.salePrice) * qty2).toFixed(2) },
      ]);
    }
  }
  console.log(`✓ POS sessions + ${orderCounter - 1} orders`);

  // ── INVENTORY TRANSACTIONS ────────────────────────────────────────────────
  const invTxData = [];
  for (const product of products.slice(0, 10)) {
    // Initial stock purchase
    invTxData.push({
      productId: product.id,
      type: "purchase" as const,
      quantity: randomInt(20, 50),
      unitPrice: product.purchasePrice,
      totalValue: product.purchasePrice ? String(parseFloat(product.purchasePrice) * randomInt(20, 50)) : null,
      notes: "Stock initial",
      actorId: adminId,
    });
  }
  await db.insert(inventoryTransactionsTable).values(invTxData);
  console.log(`✓ ${invTxData.length} inventory transactions`);

  // ── CASH RECONCILIATIONS (last 7 days) ───────────────────────────────────
  const reconcData = [];
  for (let day = 6; day >= 0; day--) {
    const d = new Date();
    d.setDate(d.getDate() - day);
    if (d.getDay() === 5) continue; // skip Friday
    const dateStr = d.toISOString().split("T")[0];
    const cashSales = String(randomInt(12000, 35000));
    const opening = day === 6 ? "5000.00" : String(randomInt(3000, 8000));
    const cashIn = cashSales;
    const cashOut = String(randomInt(500, 2000));
    const expected = (parseFloat(opening) + parseFloat(cashIn) - parseFloat(cashOut)).toFixed(2);
    const discrepancyVal = (Math.random() > 0.5 ? 1 : -1) * randomInt(0, 250);
    const closing = (parseFloat(expected) + discrepancyVal).toFixed(2);
    const isClosed = day > 0;
    reconcData.push({
      date: dateStr,
      openingBalance: opening,
      closingBalance: isClosed ? closing : null,
      cashIn,
      cashOut,
      expectedBalance: isClosed ? expected : null,
      discrepancy: isClosed ? String(discrepancyVal) : null,
      status: isClosed ? "closed" : "open",
      openedBy: receptionId,
      closedBy: isClosed ? managerId : null,
      openedAt: new Date(`${dateStr}T08:00:00`),
      closedAt: isClosed ? new Date(`${dateStr}T20:30:00`) : null,
      notes: isClosed && Math.abs(discrepancyVal) > 200
        ? `Écart constaté de ${discrepancyVal > 0 ? "+" : ""}${discrepancyVal} DZD — à vérifier`
        : null,
    });
  }
  await db.insert(cashReconciliationsTable).values(reconcData);
  console.log(`✓ ${reconcData.length} cash reconciliation records`);

  // ── FREEZE REQUESTS (sample pending requests) ──────────────────────────────
  const activeMembershipsForFreeze = memberships.filter((_, i) => i >= 0 && i < 5);
  const freezeRequestsData = activeMembershipsForFreeze.map((m, i) => {
    const memberRow = members.find((mb) => mb.id === m.memberId)!;
    const start = daysFromNow(i + 1);
    const end = daysFromNow(i + 1 + randomInt(3, 10));
    return {
      membershipId: m.id,
      memberId: memberRow.id,
      freezeStart: start,
      freezeEnd: end,
      reason: pick(["Voyage à l'étranger", "Maladie / hospitalisation", "Voyage professionnel", "Ramadan", "Examen universitaire"]),
      status: "pending" as const,
      requestedBy: receptionId,
    };
  });
  await db.insert(membershipFreezeRequestsTable).values(freezeRequestsData);
  console.log(`✓ ${freezeRequestsData.length} freeze requests`);

  // ── LOYALTY POINTS ────────────────────────────────────────────────────────
  const ledgerData = [];
  for (const member of activeMembers.slice(0, 20)) {
    const pts = randomInt(50, 450);
    ledgerData.push({
      memberId: member.id,
      points: pts,
      direction: "credit",
      sourceType: "membership_renewal",
      description: "Points gagnés lors de l'abonnement initial",
      balance: pts,
    });
  }
  await db.insert(memberPointsLedgerTable).values(ledgerData);
  console.log(`✓ ${ledgerData.length} loyalty points records`);

  // ── SYSTEM CONFIG ─────────────────────────────────────────────────────────
  await db.insert(systemConfigTable).values([
    { key: "club_name", value: "AURA Fitness Club", category: "general" },
    { key: "club_name_ar", value: "نادي AURA للياقة البدنية", category: "general" },
    { key: "club_phone", value: "+213 555 123 456", category: "general" },
    { key: "club_email", value: "contact@aurafitness.dz", category: "general" },
    { key: "club_address", value: "123 Rue de la République, Alger Centre", category: "general" },
    { key: "currency", value: "DZD", category: "billing" },
    { key: "timezone", value: "Africa/Algiers", category: "general" },
    { key: "default_language", value: "ar", category: "general" },
    { key: "opening_time", value: "06:00", category: "general" },
    { key: "closing_time", value: "22:00", category: "general" },
    { key: "friday_closed", value: "true", category: "general" },
  ]);

  // ── BUSINESS RULES ────────────────────────────────────────────────────────
  await db.insert(businessRulesTable).values([
    { key: "max_freeze_days_default", value: "7", description: "Jours de gel maximum par défaut", category: "memberships" },
    { key: "booking_cancellation_hours", value: "24", description: "Heures minimum pour annuler un cours sans pénalité", category: "classes" },
    { key: "max_no_show_per_month", value: "3", description: "No-shows max avant restriction de réservation", category: "classes" },
    { key: "cash_reconciliation_threshold", value: "500", description: "Seuil d'alerte pour l'écart de caisse (DZD)", category: "billing" },
    { key: "qr_token_validity_seconds", value: "60", description: "Validité du QR code d'accès en secondes", category: "access" },
    { key: "waitlist_notification_minutes", value: "10", description: "Minutes pour confirmer depuis la liste d'attente", category: "classes" },
    { key: "expiry_warning_days", value: "3", description: "Jours avant expiration pour envoyer une alerte", category: "memberships" },
    { key: "max_active_memberships", value: "1", description: "Nombre maximum d'abonnements actifs simultanés", category: "memberships" },
    { key: "baridimob_confirmation_required", value: "true", description: "Paiement Baridimob nécessite confirmation manuelle", category: "billing" },
  ]);
  console.log(`✓ System config + business rules`);

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log("\n✅ AURA Fitness seed complete!");
  console.log("━".repeat(50));
  console.log("\n📋 Demo accounts:");
  for (const s of staffData) {
    console.log(`   ${s.roleName.padEnd(15)} — ${s.email} / ${s.password}`);
  }
  console.log("\n📊 Data summary:");
  console.log(`   Members: ${members.length} (25 male + 25 female)`);
  console.log(`   Memberships: ${memberships.length} (35 active, 5 frozen, 5 expired, 5 cancelled)`);
  console.log(`   Plans: ${plans.length} (1500–5000 DZD)`);
  console.log(`   Class types: ${classTypes.length}`);
  console.log(`   Class sessions: ${sessions.length}`);
  console.log(`   Products: ${products.length}`);
  console.log(`   Access logs: ${accessLogsData.length}`);
  console.log(`   Notification templates: 10 (AR + FR)`);
  console.log("━".repeat(50));
}

seed()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
