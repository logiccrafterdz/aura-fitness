import { useState, useMemo } from "react";
import {
  useRevenueReport,
  useMembersReport,
  useAccessReport,
  useClassesReport,
} from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { Loader2, TrendingUp, Users, Activity, BookOpen } from "lucide-react";
import { format, parseISO } from "date-fns";

const DZD = (v: number) =>
  new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD", maximumFractionDigits: 0 }).format(v);

const CHART_COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: 12,
  },
};

function LoadingChart() {
  return (
    <div className="h-[320px] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
      {message}
    </div>
  );
}

function RevenueTab() {
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const { data, isLoading } = useRevenueReport(undefined, undefined, groupBy);

  const chartData = useMemo(() => {
    if (!data?.revenueByPeriod?.length) return [];
    const byPeriod = new Map<string, number>();
    for (const row of data.revenueByPeriod) {
      const label =
        groupBy === "month"
          ? format(parseISO(row.period), "MMM yyyy")
          : groupBy === "week"
            ? format(parseISO(row.period), "MMM d")
            : format(parseISO(row.period), "MMM d");
      byPeriod.set(label, (byPeriod.get(label) ?? 0) + Number(row.total));
    }
    return Array.from(byPeriod.entries()).map(([name, revenue]) => ({ name, revenue }));
  }, [data, groupBy]);

  const totalRevenue = chartData.reduce((s, r) => s + r.revenue, 0);
  const byMethod: any[] = data?.invoiceSummary ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Period Total</p>
            <p className="text-2xl font-bold mt-1">{DZD(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="text-2xl font-bold mt-1">
              {data?.revenueByPeriod?.reduce((s: number, r: any) => s + Number(r.transactions), 0) ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Avg / Transaction</p>
            <p className="text-2xl font-bold mt-1">
              {(() => {
                const txCount = data?.revenueByPeriod?.reduce(
                  (s: number, r: any) => s + Number(r.transactions), 0,
                ) ?? 0;
                return txCount > 0 ? DZD(totalRevenue / txCount) : "—";
              })()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-base">Revenue Over Time</CardTitle>
          <div className="flex gap-1">
            {(["day", "week", "month"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${groupBy === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingChart />
          ) : !chartData.length ? (
            <EmptyChart message="No revenue data for this period" />
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: number) => [DZD(v), "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    fill="url(#revGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {byMethod.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">By Payment Method</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMethod.map((r: any) => ({ name: r.status, amount: Number(r.amount) }))} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [DZD(v), "Amount"]} />
                  <Bar dataKey="amount" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MembersTab() {
  const { data, isLoading } = useMembersReport();

  const newMembersChart = useMemo(
    () =>
      (data?.newMembers ?? []).map((r: any) => ({
        name: format(parseISO(r.week), "MMM d"),
        count: Number(r.count),
      })),
    [data],
  );

  const genderChart = useMemo(
    () =>
      (data?.byGender ?? []).map((r: any, i: number) => ({
        name: r.gender ?? "unknown",
        value: Number(r.count),
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [data],
  );

  const planChart = useMemo(
    () =>
      (data?.byPlan ?? [])
        .filter((r: any) => r.status === "active")
        .map((r: any, i: number) => ({
          name: r.plan_name,
          count: Number(r.count),
          fill: CHART_COLORS[i % CHART_COLORS.length],
        })),
    [data],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">New Members per Week</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingChart />
          ) : !newMembersChart.length ? (
            <EmptyChart message="No new member data" />
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={newMembersChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [v, "New Members"]} />
                  <Bar dataKey="count" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">By Gender</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingChart />
            ) : !genderChart.length ? (
              <EmptyChart message="No data" />
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={genderChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {genderChart.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [v, "Members"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Active by Plan</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingChart />
            ) : !planChart.length ? (
              <EmptyChart message="No data" />
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={planChart} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={80} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [v, "Members"]} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {planChart.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AccessTab() {
  const { data, isLoading } = useAccessReport();

  const dailyChart = useMemo(
    () =>
      (data?.daily ?? []).map((r: any) => ({
        name: format(parseISO(r.day), "MMM d"),
        allowed: Number(r.allowed),
        denied: Number(r.denied),
      })),
    [data],
  );

  const peakHoursChart = useMemo(
    () =>
      (data?.peakHours ?? []).map((r: any) => ({
        name: `${String(Math.round(Number(r.hour))).padStart(2, "0")}:00`,
        count: Number(r.count),
      })),
    [data],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Daily Access — Allowed vs Denied</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingChart />
          ) : !dailyChart.length ? (
            <EmptyChart message="No access data for this period" />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend />
                  <Bar dataKey="allowed" name="Allowed" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="denied" name="Denied" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Peak Hours (Allowed)</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingChart />
          ) : !peakHoursChart.length ? (
            <EmptyChart message="No peak hour data" />
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakHoursChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [v, "Check-ins"]} />
                  <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClassesTab() {
  const { data, isLoading } = useClassesReport();

  const attendanceChart = useMemo(
    () =>
      (data?.attendanceRate ?? []).map((r: any) => ({
        name: r.name,
        attended: Number(r.attended),
        noShow: Number(r.no_show),
        total: Number(r.total_bookings),
      })),
    [data],
  );

  const bookingStatusChart = useMemo(
    () =>
      (data?.bookingStats ?? []).map((r: any, i: number) => ({
        name: r.status,
        value: Number(r.count),
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [data],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Attendance by Class Type</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingChart />
          ) : !attendanceChart.length ? (
            <EmptyChart message="No class data for this period" />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend />
                  <Bar dataKey="attended" name="Attended" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="noShow" name="No Show" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Booking Status Distribution</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingChart />
            ) : !bookingStatusChart.length ? (
              <EmptyChart message="No booking data" />
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={bookingStatusChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {bookingStatusChart.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [v, "Bookings"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {data?.sessionStats && (
          <Card>
            <CardHeader><CardTitle className="text-base">Top Classes by Bookings</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.sessionStats.slice(0, 6).map((r: any) => (
                  <div key={r.name} className="flex items-center gap-2">
                    <span className="text-sm truncate flex-1">{r.name}</span>
                    <span className="text-sm font-semibold text-muted-foreground">{r.total_bookings}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function Reports() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1">Analytics and club performance metrics.</p>
      </div>

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue"><TrendingUp className="w-3.5 h-3.5 mr-1.5" />Revenue</TabsTrigger>
          <TabsTrigger value="members"><Users className="w-3.5 h-3.5 mr-1.5" />Members</TabsTrigger>
          <TabsTrigger value="access"><Activity className="w-3.5 h-3.5 mr-1.5" />Access</TabsTrigger>
          <TabsTrigger value="classes"><BookOpen className="w-3.5 h-3.5 mr-1.5" />Classes</TabsTrigger>
        </TabsList>
        <TabsContent value="revenue" className="mt-6"><RevenueTab /></TabsContent>
        <TabsContent value="members" className="mt-6"><MembersTab /></TabsContent>
        <TabsContent value="access" className="mt-6"><AccessTab /></TabsContent>
        <TabsContent value="classes" className="mt-6"><ClassesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
