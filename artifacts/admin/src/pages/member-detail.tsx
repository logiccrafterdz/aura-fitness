import { useState, useEffect } from "react";
import {
  useMember,
  useMemberTimeline,
  useMemberMemberships,
  useMemberInvoices,
  useMemberBookings,
  useMemberAccessLogs,
  useMemberAccessToken,
  useMemberStatusChange,
  useMemberLoyaltyLedger,
  useLoyaltyRewards,
  useRedeemReward,
  useAdjustMemberPoints,
} from "@/hooks/use-api";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  User,
  QrCode,
  Clock,
  CreditCard,
  Calendar,
  Activity,
  BookOpen,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldAlert,
  Gift,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import QRCodeLib from "qrcode";
import { useToast } from "@/hooks/use-toast";

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  inactive: "secondary",
  suspended: "destructive",
  pending: "outline",
};

function QRCodeTab({ memberId }: { memberId: string }) {
  const [qrSrc, setQrSrc] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const { data: tokenData, refetch, isFetching } = useMemberAccessToken(memberId, false);

  useEffect(() => {
    if (!tokenData?.token) return;
    QRCodeLib.toDataURL(tokenData.token, { width: 240, margin: 2 }).then(setQrSrc);
    const exp = new Date(tokenData.expiresAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.round((exp - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [tokenData?.token]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="w-5 h-5" />
          Access QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 py-6">
        {!tokenData && !isFetching && (
          <>
            <QrCode className="w-20 h-20 text-muted-foreground/20" />
            <p className="text-muted-foreground text-sm text-center max-w-xs">
              Generate a one-time QR code for this member (valid 60 seconds).
            </p>
            <Button onClick={() => refetch()} size="sm">
              <QrCode className="w-4 h-4 mr-2" />
              Generate QR Code
            </Button>
          </>
        )}

        {isFetching && <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />}

        {tokenData && qrSrc && (
          <>
            <div className="p-4 bg-white rounded-2xl border shadow-sm">
              <img src={qrSrc} alt="Access QR" width={200} height={200} />
            </div>
            {secondsLeft !== null && (
              <p className={`text-sm font-medium ${secondsLeft < 10 ? "text-red-500" : "text-muted-foreground"}`}>
                <Clock className="inline w-3.5 h-3.5 mr-1" />
                Expires in {secondsLeft}s
              </p>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh Token
            </Button>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Show this QR code at the kiosk or access terminal for entry.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineTab({ memberId }: { memberId: string }) {
  const { data: events, isLoading } = useMemberTimeline(memberId);
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  return (
    <Card>
      <CardHeader><CardTitle>Member Timeline</CardTitle></CardHeader>
      <CardContent>
        {!events?.length ? (
          <div className="py-8 text-center text-muted-foreground">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-25" />
            <p>No timeline events yet</p>
          </div>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-6">
              {events.map((ev: any, i: number) => (
                <div key={ev.id ?? i} className="relative">
                  <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                  <p className="text-sm font-medium capitalize">{ev.eventType?.replace(/_/g, " ")}</p>
                  {ev.description && <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>}
                  <p className="text-xs text-muted-foreground/50 mt-1">
                    {format(new Date(ev.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MembershipsTab({ memberId }: { memberId: string }) {
  const { data: rows, isLoading } = useMemberMemberships(memberId);
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  return (
    <div className="space-y-3">
      {!rows?.length && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto mb-2 opacity-25" /><p>No memberships found</p>
        </CardContent></Card>
      )}
      {rows?.map((m: any) => {
        const daysLeft = differenceInDays(new Date(m.endDate), new Date());
        return (
          <Card key={m.id}>
            <CardContent className="pt-4 pb-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{m.planName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(m.startDate), "MMM d, yyyy")} – {format(new Date(m.endDate), "MMM d, yyyy")}
                </p>
                {m.planPrice && (
                  <p className="text-xs text-muted-foreground">{Number(m.planPrice).toLocaleString("fr-DZ")} DZD</p>
                )}
              </div>
              <div className="text-right space-y-1">
                <Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status}</Badge>
                {m.status === "active" && daysLeft >= 0 && (
                  <p className={`text-xs ${daysLeft < 7 ? "text-amber-500" : "text-muted-foreground"}`}>
                    {daysLeft}d left
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function InvoicesTab({ memberId }: { memberId: string }) {
  const { data: rows, isLoading } = useMemberInvoices(memberId);
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  return (
    <div className="space-y-3">
      {!rows?.length && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-25" /><p>No invoices found</p>
        </CardContent></Card>
      )}
      {rows?.map((inv: any) => (
        <Card key={inv.id}>
          <CardContent className="pt-4 pb-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-sm font-medium">{inv.invoiceNumber}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(inv.createdAt), "MMM d, yyyy")}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{Number(inv.total).toLocaleString("fr-DZ")} DZD</p>
              <Badge
                variant={inv.status === "paid" ? "default" : inv.status === "pending" ? "outline" : "destructive"}
                className="text-xs mt-1"
              >{inv.status}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BookingsTab({ memberId }: { memberId: string }) {
  const { data: rows, isLoading } = useMemberBookings(memberId);
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  return (
    <div className="space-y-3">
      {!rows?.length && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-25" /><p>No bookings found</p>
        </CardContent></Card>
      )}
      {rows?.map((b: any) => (
        <Card key={b.id}>
          <CardContent className="pt-4 pb-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{b.className ?? "Class"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {b.sessionStartsAt ? format(new Date(b.sessionStartsAt), "MMM d, yyyy · h:mm a") : "—"}
              </p>
            </div>
            <Badge
              variant={b.status === "attended" ? "default" : b.status === "no_show" ? "destructive" : "outline"}
              className="text-xs"
            >{b.status}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AccessLogsTab({ memberId }: { memberId: string }) {
  const { data: rows, isLoading } = useMemberAccessLogs(memberId);
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  return (
    <div className="space-y-2">
      {!rows?.length && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <Activity className="w-10 h-10 mx-auto mb-2 opacity-25" /><p>No access logs found</p>
        </CardContent></Card>
      )}
      {rows?.map((log: any) => (
        <Card key={log.id}>
          <CardContent className="pt-3 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {log.result === "allowed"
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
              <div>
                <p className="text-sm font-medium capitalize">{log.result}</p>
                {log.denialReason && <p className="text-xs text-muted-foreground">{log.denialReason}</p>}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(log.createdAt), "MMM d · h:mm a")}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LoyaltyTab({ memberId }: { memberId: string }) {
  const { data, isLoading } = useMemberLoyaltyLedger(memberId);
  const { data: rewards } = useLoyaltyRewards();
  const redeemMutation = useRedeemReward(memberId);
  const adjustMutation = useAdjustMemberPoints(memberId);
  
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  
  const [redeemDialog, setRedeemDialog] = useState(false);
  const [selectedReward, setSelectedReward] = useState("");

  const { toast } = useToast();

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const handleAdjust = async () => {
    if (adjustPoints === 0 || !adjustReason) return;
    try {
      await adjustMutation.mutateAsync({ points: adjustPoints, description: adjustReason });
      toast({ title: "Points Adjusted", description: "Member points balance updated." });
      setAdjustDialog(false);
      setAdjustPoints(0);
      setAdjustReason("");
    } catch {
      toast({ title: "Error", description: "Failed to adjust points.", variant: "destructive" });
    }
  };

  const handleRedeem = async () => {
    if (!selectedReward) return;
    try {
      await redeemMutation.mutateAsync({ rewardId: selectedReward });
      toast({ title: "Reward Redeemed", description: "Reward claimed successfully." });
      setRedeemDialog(false);
      setSelectedReward("");
    } catch {
      toast({ title: "Error", description: "Failed to redeem reward. Check balance or stock.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Gift className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Points Balance</p>
              <h2 className="text-3xl font-bold">{data?.balance || 0} <span className="text-sm font-normal text-muted-foreground">pts</span></h2>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAdjustDialog(true)}>Adjust Balance</Button>
            <Button onClick={() => setRedeemDialog(true)}>Redeem Reward</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Points Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!data?.ledger?.length ? (
              <p className="text-center text-muted-foreground py-4">No points history found.</p>
            ) : (
              data.ledger.map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{entry.description || "Points Adjustment"}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(entry.createdAt), "MMM d, yyyy h:mm a")}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${entry.direction === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {entry.direction === 'in' ? '+' : '-'}{entry.points}
                    </p>
                    <p className="text-xs text-muted-foreground">Balance: {entry.balance}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Points Balance</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Points to Adjust (Use negative for deduction)</Label>
              <Input type="number" value={adjustPoints} onChange={e => setAdjustPoints(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="e.g. Compensation, Manual deduction" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustDialog(false)}>Cancel</Button>
            <Button onClick={handleAdjust} disabled={adjustMutation.isPending || adjustPoints === 0 || !adjustReason}>
              {adjustMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={redeemDialog} onOpenChange={setRedeemDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redeem Reward</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Reward</Label>
              <Select value={selectedReward} onValueChange={setSelectedReward}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a reward..." />
                </SelectTrigger>
                <SelectContent>
                  {rewards?.filter((r: any) => r.isActive).map((reward: any) => (
                    <SelectItem key={reward.id} value={reward.id} disabled={(data?.balance || 0) < reward.pointsCost}>
                      {reward.name} ({reward.pointsCost} pts) - {reward.stock !== null ? `${reward.stock} in stock` : "Unlimited"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRedeemDialog(false)}>Cancel</Button>
            <Button onClick={handleRedeem} disabled={redeemMutation.isPending || !selectedReward}>
              {redeemMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Redeem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
];

export default function MemberDetail() {
  const { id } = useParams();
  const { data: member, isLoading } = useMember(id as string);
  const [statusDialog, setStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const statusChangeMutation = useMemberStatusChange(id as string);
  const { toast } = useToast();

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!member) {
    return <div className="p-8 text-center text-muted-foreground"><AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>Member not found.</p></div>;
  }

  const daysLeft = member.activeMembership?.endDate
    ? differenceInDays(new Date(member.activeMembership.endDate), new Date())
    : null;

  const handleStatusChange = async () => {
    if (!newStatus || !statusReason.trim()) return;
    try {
      await statusChangeMutation.mutateAsync({ status: newStatus, reason: statusReason });
      toast({ title: "Status updated", description: `Member status changed to ${newStatus}.` });
      setStatusDialog(false);
      setNewStatus("");
      setStatusReason("");
    } catch {
      toast({ title: "Error", description: "Failed to update member status.", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="w-7 h-7 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-serif font-bold">{member.firstName} {member.lastName}</h1>
            <Badge variant={STATUS_BADGE[member.status] ?? "secondary"}>{member.status}</Badge>
          </div>
          {member.firstNameAr && (
            <p className="text-muted-foreground text-sm" dir="rtl">{member.firstNameAr} {member.lastNameAr}</p>
          )}
          <p className="text-muted-foreground text-sm font-mono">#{member.memberNumber}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {member.activeMembership && daysLeft !== null && (
            <div className={`text-right ${daysLeft < 7 ? "text-amber-500" : daysLeft < 0 ? "text-red-500" : "text-emerald-600"}`}>
              <p className="text-sm font-semibold">{member.activeMembership.planName}</p>
              <p className="text-xs mt-0.5">{daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? "Expires today" : "Expired"}</p>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setNewStatus(member.status); setStatusDialog(true); }}
          >
            <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
            Change Status
          </Button>
        </div>
      </div>

      {/* Status Change Dialog */}
      <Dialog open={statusDialog} onOpenChange={(o) => { if (!o) { setStatusDialog(false); setNewStatus(""); setStatusReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Member Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.filter(s => s.value !== member.status).map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <Textarea
                placeholder="Explain the reason for this status change..."
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStatusDialog(false)}>Cancel</Button>
            <Button
              onClick={handleStatusChange}
              disabled={statusChangeMutation.isPending || !newStatus || !statusReason.trim()}
              variant={newStatus === "suspended" ? "destructive" : "default"}
            >
              {statusChangeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview"><User className="w-3.5 h-3.5 mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="qr"><QrCode className="w-3.5 h-3.5 mr-1.5" />QR Code</TabsTrigger>
          <TabsTrigger value="timeline"><Clock className="w-3.5 h-3.5 mr-1.5" />Timeline</TabsTrigger>
          <TabsTrigger value="loyalty"><Gift className="w-3.5 h-3.5 mr-1.5" />Loyalty</TabsTrigger>
          <TabsTrigger value="memberships"><Calendar className="w-3.5 h-3.5 mr-1.5" />Memberships</TabsTrigger>
          <TabsTrigger value="invoices"><CreditCard className="w-3.5 h-3.5 mr-1.5" />Invoices</TabsTrigger>
          <TabsTrigger value="bookings"><BookOpen className="w-3.5 h-3.5 mr-1.5" />Bookings</TabsTrigger>
          <TabsTrigger value="access"><Activity className="w-3.5 h-3.5 mr-1.5" />Access</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Email", member.email],
                  ["Phone", member.phone],
                  ["Gender", member.gender ? member.gender.charAt(0).toUpperCase() + member.gender.slice(1) : "—"],
                  ["Date of Birth", member.dateOfBirth ? format(new Date(member.dateOfBirth), "MMM d, yyyy") : "—"],
                  ["Joined", format(new Date(member.createdAt), "MMM d, yyyy")],
                  ["Address", member.address ?? "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground font-medium">{label}</p>
                    <p className="mt-0.5 break-words">{value}</p>
                  </div>
                ))}
                {member.emergencyContact && (
                  <div className="col-span-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground font-medium">Emergency Contact</p>
                    <p className="mt-0.5">{member.emergencyContact}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Active Membership</CardTitle></CardHeader>
              <CardContent>
                {member.activeMembership ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="text-emerald-700 dark:text-emerald-400 text-sm font-medium">Active Membership</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Plan</p>
                        <p className="font-medium mt-0.5">{member.activeMembership.planName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Valid Until</p>
                        <p className="font-medium mt-0.5">{format(new Date(member.activeMembership.endDate), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                    {daysLeft !== null && daysLeft <= 14 && daysLeft >= 0 && (
                      <p className="text-xs text-amber-600 font-medium">⚠ Expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}</p>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No active membership</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          {member.medicalNotes && (
            <Card>
              <CardHeader><CardTitle className="text-base">Medical Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{member.medicalNotes}</p></CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="qr" className="mt-6"><QRCodeTab memberId={id as string} /></TabsContent>
        <TabsContent value="timeline" className="mt-6"><TimelineTab memberId={id as string} /></TabsContent>
        <TabsContent value="loyalty" className="mt-6"><LoyaltyTab memberId={id as string} /></TabsContent>
        <TabsContent value="memberships" className="mt-6"><MembershipsTab memberId={id as string} /></TabsContent>
        <TabsContent value="invoices" className="mt-6"><InvoicesTab memberId={id as string} /></TabsContent>
        <TabsContent value="bookings" className="mt-6"><BookingsTab memberId={id as string} /></TabsContent>
        <TabsContent value="access" className="mt-6"><AccessLogsTab memberId={id as string} /></TabsContent>
      </Tabs>
    </div>
  );
}
