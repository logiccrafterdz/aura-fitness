import { useDashboard } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, CreditCard, Activity, CalendarDays,
  AlertTriangle, Clock, Package, TrendingUp,
  CheckCircle, XCircle, Smartphone,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, Cell } from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const dzd = (v: number) =>
  new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD", maximumFractionDigits: 0 }).format(v);

function StatCard({ title, value, sub, icon: Icon, accent }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${accent || "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <div className="p-8 space-y-8">
        <h1 className="text-3xl font-serif font-bold tracking-tight">Tableau de bord</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[400px] lg:col-span-2" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  const pendingBaridimob = data?.operations?.pendingBaridimob ?? 0;
  const pendingPayments = data?.operations?.pendingPayments ?? 0;
  const lowStock = data?.operations?.lowStockProducts ?? [];
  const todaysClasses = data?.operations?.todaysClasses ?? [];
  const expiringSoon = data?.memberships?.expiringSoonList ?? [];
  const revenueByMethod: any[] = data?.revenue?.byMethod ?? [];

  const methodColors: Record<string, string> = {
    cash: "#22c55e",
    baridimob: "#f59e0b",
    cib: "#3b82f6",
    edahabia: "#8b5cf6",
    other: "#6b7280",
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble de votre club aujourd'hui.</p>
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────────── */}
      {(pendingBaridimob > 0 || lowStock.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {pendingBaridimob > 0 && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-lg px-4 py-2.5 text-sm font-medium">
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>{pendingBaridimob} paiement{pendingBaridimob > 1 ? "s" : ""} Baridimob en attente de confirmation</span>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-4 py-2.5 text-sm font-medium">
              <Package className="w-4 h-4 shrink-0" />
              <span>{lowStock.length} produit{lowStock.length > 1 ? "s" : ""} en stock faible</span>
            </div>
          )}
        </div>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Membres actifs"
          value={data?.members?.active ?? 0}
          sub={`Sur ${data?.members?.total ?? 0} membres au total`}
          icon={Users}
        />
        <StatCard
          title="Revenus (aujourd'hui)"
          value={dzd(data?.revenue?.today ?? 0)}
          sub={`${dzd(data?.revenue?.thisMonth ?? 0)} ce mois`}
          icon={CreditCard}
          accent="text-emerald-500"
        />
        <StatCard
          title="Entrées (aujourd'hui)"
          value={data?.access?.today ?? 0}
          sub="Check-ins validés"
          icon={Activity}
          accent="text-blue-500"
        />
        <StatCard
          title="Paiements en attente"
          value={pendingPayments}
          sub={pendingBaridimob > 0 ? `${pendingBaridimob} Baridimob à confirmer` : "Aucun Baridimob en attente"}
          icon={pendingBaridimob > 0 ? AlertTriangle : CheckCircle}
          accent={pendingBaridimob > 0 ? "text-amber-500" : "text-emerald-500"}
        />
      </div>

      {/* ── Main Grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Revenue by method */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Revenus par méthode de paiement — ce mois</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByMethod.length > 0 ? (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByMethod} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <XAxis dataKey="method" fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                      formatter={(v: any) => [dzd(Number(v)), "Total"]}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {revenueByMethod.map((entry: any, i: number) => (
                        <Cell key={i} fill={methodColors[entry.method] ?? "#6b7280"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                Aucune donnée de paiement ce mois
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[260px] overflow-y-auto pr-1">
              {data?.access?.recentActivity?.length > 0 ? (
                data.access.recentActivity.slice(0, 12).map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                      a.result === "allowed" ? "bg-green-500/10" : "bg-red-500/10"
                    }`}>
                      {a.result === "allowed"
                        ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.firstName} {a.lastName}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.result === "allowed" ? "Accès accordé" : `Refusé — ${a.denialReason ?? "inconnu"}`}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(a.createdAt), "HH:mm")}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">Aucune activité récente</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Today's Classes ────────────────────────────────────────────── */}
      {todaysClasses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Cours d'aujourd'hui ({todaysClasses.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {todaysClasses.map((cls: any) => {
                const fill = cls.fillRate ?? 0;
                const isOngoing = cls.status === "ongoing";
                const isCancelled = cls.status === "cancelled";
                return (
                  <div key={cls.id} className={`rounded-lg border p-4 space-y-3 ${isOngoing ? "border-primary/40 bg-primary/5" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          {cls.classColor && (
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cls.classColor }} />
                          )}
                          <span className="font-medium text-sm">{cls.className}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{cls.room}</p>
                      </div>
                      {isOngoing && <Badge className="shrink-0 text-xs bg-primary/20 text-primary border-primary/30">En cours</Badge>}
                      {isCancelled && <Badge variant="destructive" className="shrink-0 text-xs">Annulé</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {format(new Date(cls.startsAt), "HH:mm")} — {format(new Date(cls.endsAt), "HH:mm")}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{cls.currentBookings ?? 0} / {cls.maxCapacity} places</span>
                        <span className={fill >= 90 ? "text-red-500 font-medium" : fill >= 70 ? "text-amber-500" : "text-emerald-500"}>
                          {fill}%
                        </span>
                      </div>
                      <Progress value={fill} className="h-1.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Bottom Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Expiring memberships */}
        {expiringSoon.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Abonnements expirant bientôt ({expiringSoon.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {expiringSoon.slice(0, 8).map((m: any) => {
                const daysLeft = Math.ceil((new Date(m.endDate).getTime() - Date.now()) / 86400000);
                return (
                  <div key={m.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{m.firstName} {m.lastName}</p>
                      <p className="text-xs text-muted-foreground">{m.planName} · #{m.memberNumber}</p>
                    </div>
                    <Badge variant={daysLeft <= 1 ? "destructive" : daysLeft <= 3 ? "secondary" : "outline"} className="shrink-0">
                      {daysLeft <= 0 ? "Expiré" : `J-${daysLeft}`}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Low stock */}
        {lowStock.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Package className="w-5 h-5 text-red-500" />
                Stock faible ({lowStock.length} produits)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lowStock.slice(0, 8).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{p.category}</p>
                  </div>
                  <Badge variant="destructive" className="shrink-0">
                    {p.stockQuantity} restants
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
