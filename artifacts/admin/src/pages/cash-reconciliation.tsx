import { useState } from "react";
import {
  useCashReconciliations,
  useCurrentCashReconciliation,
  useOpenCashReconciliation,
  useCloseCashReconciliation,
} from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Banknote, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Plus, Lock } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function CashReconciliation() {
  const [page, setPage] = useState(1);
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [openForm, setOpenForm] = useState({ openingBalance: "", notes: "" });
  const [closeForm, setCloseForm] = useState({ closingBalance: "", cashIn: "", cashOut: "", notes: "" });
  const limit = 10;
  const { toast } = useToast();

  const { data: current, isLoading: currentLoading } = useCurrentCashReconciliation();
  const { data, isLoading } = useCashReconciliations(page, limit);
  const openMutation = useOpenCashReconciliation();
  const closeMutation = useCloseCashReconciliation(current?.id ?? "");

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const handleOpen = async () => {
    try {
      await openMutation.mutateAsync({
        openingBalance: openForm.openingBalance || "0",
        notes: openForm.notes || undefined,
      });
      toast({ title: "Register opened", description: "Today's cash session has been opened." });
      setOpenDialog(false);
      setOpenForm({ openingBalance: "", notes: "" });
    } catch {
      toast({ title: "Error", description: "Could not open register.", variant: "destructive" });
    }
  };

  const handleClose = async () => {
    if (!current) return;
    try {
      await closeMutation.mutateAsync({
        closingBalance: closeForm.closingBalance,
        cashIn: closeForm.cashIn,
        cashOut: closeForm.cashOut || "0",
        notes: closeForm.notes || undefined,
      });
      toast({ title: "Register closed", description: "Today's reconciliation is saved." });
      setCloseDialog(false);
      setCloseForm({ closingBalance: "", cashIn: "", cashOut: "", notes: "" });
    } catch {
      toast({ title: "Error", description: "Could not close register.", variant: "destructive" });
    }
  };

  const computedDiscrepancy = () => {
    if (!closeForm.closingBalance || !closeForm.cashIn) return null;
    const opening = parseFloat(current?.openingBalance ?? "0");
    const cashIn = parseFloat(closeForm.cashIn || "0");
    const cashOut = parseFloat(closeForm.cashOut || "0");
    const expected = opening + cashIn - cashOut;
    const diff = parseFloat(closeForm.closingBalance) - expected;
    return { expected, diff };
  };

  const discrepancyPreview = computedDiscrepancy();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Banknote className="w-7 h-7 text-emerald-500" />
            <h1 className="text-3xl font-serif font-bold tracking-tight">Cash Reconciliation</h1>
          </div>
          <p className="text-muted-foreground mt-1">Daily cash register management and end-of-day reconciliation.</p>
        </div>
        {!currentLoading && (
          current?.status === "open" ? (
            <Button
              variant="destructive"
              onClick={() => setCloseDialog(true)}
            >
              <Lock className="w-4 h-4 mr-2" />
              Close Register
            </Button>
          ) : (
            <Button onClick={() => setOpenDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Open Today's Register
            </Button>
          )
        )}
      </div>

      {/* Today's Status Banner */}
      {!currentLoading && current && (
        <Card className={`border-2 ${current.status === "open" ? "border-emerald-300 bg-emerald-50/50" : "border-gray-200"}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {current.status === "open" ? (
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <p className="font-semibold text-sm">
                    Today — {format(new Date(), "EEEE d MMMM yyyy")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Opened at {current.openedAt ? format(new Date(current.openedAt), "HH:mm") : "–"}
                    {current.closedAt && ` · Closed at ${format(new Date(current.closedAt), "HH:mm")}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-8 text-right">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Opening</p>
                  <p className="font-semibold font-mono">{parseFloat(current.openingBalance ?? "0").toLocaleString()} DZD</p>
                </div>
                {current.cashIn && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Cash In</p>
                    <p className="font-semibold font-mono text-emerald-600">+{parseFloat(current.cashIn).toLocaleString()} DZD</p>
                  </div>
                )}
                {current.closingBalance && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Closing</p>
                    <p className="font-semibold font-mono">{parseFloat(current.closingBalance).toLocaleString()} DZD</p>
                  </div>
                )}
                {current.discrepancy && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Discrepancy</p>
                    <p className={`font-semibold font-mono ${parseFloat(current.discrepancy) < 0 ? "text-red-600" : parseFloat(current.discrepancy) > 0 ? "text-yellow-600" : "text-green-600"}`}>
                      {parseFloat(current.discrepancy) >= 0 ? "+" : ""}{parseFloat(current.discrepancy).toLocaleString()} DZD
                    </p>
                  </div>
                )}
                <Badge className={current.status === "open" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"}>
                  {current.status === "open" ? "Open" : "Closed"}
                </Badge>
              </div>
            </div>
            {current.notes && (
              <p className="mt-3 text-sm text-muted-foreground border-t pt-3">{current.notes}</p>
            )}
          </CardContent>
        </Card>
      )}
      {!currentLoading && !current && (
        <Card className="border-dashed border-2">
          <CardContent className="p-6 text-center text-muted-foreground">
            <Banknote className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No register open today</p>
            <p className="text-sm mt-1">Open today's register to start tracking cash transactions.</p>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">Reconciliation History</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Cash In</TableHead>
                  <TableHead className="text-right">Cash Out</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                  <TableHead className="text-right">Discrepancy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No reconciliation records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row: any) => {
                    const disc = parseFloat(row.discrepancy ?? "0");
                    const discColor = disc < -100 ? "text-red-600" : disc > 100 ? "text-yellow-600" : "text-green-600";
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {row.date ? format(new Date(row.date + "T00:00:00"), "EEE d MMM yyyy") : "–"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {parseFloat(row.openingBalance ?? "0").toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-emerald-600">
                          {row.cashIn ? `+${parseFloat(row.cashIn).toLocaleString()}` : "–"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-red-500">
                          {row.cashOut && parseFloat(row.cashOut) > 0 ? `-${parseFloat(row.cashOut).toLocaleString()}` : "–"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {row.expectedBalance ? parseFloat(row.expectedBalance).toLocaleString() : "–"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {row.closingBalance ? parseFloat(row.closingBalance).toLocaleString() : "–"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.discrepancy != null ? (
                            <div className={`flex items-center justify-end gap-1 font-mono text-sm font-semibold ${discColor}`}>
                              {Math.abs(disc) > 100 && <AlertTriangle className="w-3.5 h-3.5" />}
                              {disc >= 0 ? "+" : ""}{parseFloat(row.discrepancy).toLocaleString()}
                            </div>
                          ) : "–"}
                        </TableCell>
                        <TableCell>
                          <Badge className={row.status === "open" ? "bg-emerald-100 text-emerald-800" : row.status === "disputed" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700"}>
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                          {row.notes ?? "–"}
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
          <span>{total} records</span>
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

      {/* Open Register Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open Today's Register</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Opening Cash Balance (DZD)</Label>
              <Input
                type="number"
                placeholder="e.g. 5000"
                value={openForm.openingBalance}
                onChange={(e) => setOpenForm(f => ({ ...f, openingBalance: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Amount of cash in the register at opening.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any notes for this session..."
                value={openForm.notes}
                onChange={(e) => setOpenForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button onClick={handleOpen} disabled={openMutation.isPending}>
              {openMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Open Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Register Dialog */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Close Today's Register</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted rounded-md p-3 text-sm">
              <p className="text-muted-foreground">Opening balance</p>
              <p className="font-semibold font-mono">{parseFloat(current?.openingBalance ?? "0").toLocaleString()} DZD</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Total Cash In (DZD) *</Label>
                <Input
                  type="number"
                  placeholder="e.g. 18000"
                  value={closeForm.cashIn}
                  onChange={(e) => setCloseForm(f => ({ ...f, cashIn: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Total Cash Out (DZD)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={closeForm.cashOut}
                  onChange={(e) => setCloseForm(f => ({ ...f, cashOut: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Physical Closing Balance (DZD) *</Label>
              <Input
                type="number"
                placeholder="Count the cash in the register"
                value={closeForm.closingBalance}
                onChange={(e) => setCloseForm(f => ({ ...f, closingBalance: e.target.value }))}
              />
            </div>
            {discrepancyPreview && (
              <div className={`rounded-md p-3 text-sm ${Math.abs(discrepancyPreview.diff) > 500 ? "bg-red-50 border border-red-200" : Math.abs(discrepancyPreview.diff) > 100 ? "bg-yellow-50 border border-yellow-200" : "bg-green-50 border border-green-200"}`}>
                <p className="text-muted-foreground">Expected balance: <span className="font-mono font-semibold">{discrepancyPreview.expected.toLocaleString()} DZD</span></p>
                <p className={`font-semibold mt-0.5 ${Math.abs(discrepancyPreview.diff) < 0.01 ? "text-green-700" : discrepancyPreview.diff < 0 ? "text-red-700" : "text-yellow-700"}`}>
                  Discrepancy: {discrepancyPreview.diff >= 0 ? "+" : ""}{discrepancyPreview.diff.toFixed(2)} DZD
                  {Math.abs(discrepancyPreview.diff) > 500 && " ⚠ Large discrepancy — verify before closing."}
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any notes for this reconciliation..."
                value={closeForm.notes}
                onChange={(e) => setCloseForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloseDialog(false)}>Cancel</Button>
            <Button
              onClick={handleClose}
              disabled={closeMutation.isPending || !closeForm.closingBalance || !closeForm.cashIn}
              variant="destructive"
            >
              {closeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Close & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
