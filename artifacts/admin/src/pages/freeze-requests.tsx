import { useState } from "react";
import { useFreezeRequests, useApproveFreezeRequest, useRejectFreezeRequest } from "@/hooks/use-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Check, X, Snowflake, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

export default function FreezeRequests() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionDialog, setActionDialog] = useState<{ type: "approve" | "reject"; id: string; memberName: string } | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const limit = 15;
  const { toast } = useToast();

  const { data, isLoading } = useFreezeRequests(page, limit, statusFilter);
  const approve = useApproveFreezeRequest();
  const reject = useRejectFreezeRequest();

  const handleAction = async () => {
    if (!actionDialog) return;
    try {
      if (actionDialog.type === "approve") {
        await approve.mutateAsync({ id: actionDialog.id, adminNotes: adminNotes || undefined });
        toast({ title: "Request approved", description: "Membership has been frozen successfully." });
      } else {
        await reject.mutateAsync({ id: actionDialog.id, adminNotes: adminNotes || undefined });
        toast({ title: "Request rejected", description: "Freeze request has been rejected." });
      }
      setActionDialog(null);
      setAdminNotes("");
    } catch {
      toast({ title: "Error", description: "Action failed. Please try again.", variant: "destructive" });
    }
  };

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const pendingCount = rows.filter((r: any) => r.status === "pending").length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Snowflake className="w-7 h-7 text-blue-500" />
            <h1 className="text-3xl font-serif font-bold tracking-tight">Freeze Requests</h1>
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500 text-white text-xs font-bold">
                {pendingCount}
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Review and approve member membership freeze requests.</p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Freeze Period</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <Snowflake className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No freeze requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((req: any) => {
                    const days = req.freezeStart && req.freezeEnd
                      ? Math.round((new Date(req.freezeEnd).getTime() - new Date(req.freezeStart).getTime()) / 86400000)
                      : "–";
                    return (
                      <TableRow key={req.id}>
                        <TableCell>
                          <Link href={`/members/${req.memberId}`} className="font-medium hover:underline">
                            {req.memberFirstName} {req.memberLastName}
                          </Link>
                          <p className="text-xs text-muted-foreground">{req.memberNumber}</p>
                        </TableCell>
                        <TableCell className="text-sm">{req.planName ?? "–"}</TableCell>
                        <TableCell className="text-sm font-mono whitespace-nowrap">
                          {req.freezeStart ? format(new Date(req.freezeStart), "dd/MM/yy") : "–"}
                          {" → "}
                          {req.freezeEnd ? format(new Date(req.freezeEnd), "dd/MM/yy") : "–"}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-blue-600">{days}d</span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {req.reason ?? "–"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {req.requestedAt ? format(new Date(req.requestedAt), "dd/MM/yyyy HH:mm") : "–"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${statusColors[req.status] ?? ""}`}>
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {req.status === "pending" && (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => setActionDialog({ type: "approve", id: req.id, memberName: `${req.memberFirstName} ${req.memberLastName}` })}
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => setActionDialog({ type: "reject", id: req.id, memberName: `${req.memberFirstName} ${req.memberLastName}` })}
                              >
                                <X className="w-3.5 h-3.5 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                          {req.status !== "pending" && (
                            <span className="text-xs text-muted-foreground italic">
                              {req.adminNotes ?? "No note"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} total requests</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span>Page {page} of {totalPages}</span>
            <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!actionDialog} onOpenChange={(o) => { if (!o) { setActionDialog(null); setAdminNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === "approve" ? "Approve Freeze Request" : "Reject Freeze Request"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {actionDialog?.type === "approve"
                ? `Approve the freeze request from ${actionDialog?.memberName}? The membership will be frozen and extended accordingly.`
                : `Reject the freeze request from ${actionDialog?.memberName}?`}
            </p>
            <div className="space-y-1.5">
              <Label>Admin Note (optional)</Label>
              <Textarea
                placeholder="Add a note for the member or for internal records..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setActionDialog(null); setAdminNotes(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={approve.isPending || reject.isPending}
              variant={actionDialog?.type === "approve" ? "default" : "destructive"}
            >
              {(approve.isPending || reject.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {actionDialog?.type === "approve" ? "Approve & Freeze" : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
