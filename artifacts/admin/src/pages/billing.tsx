import { useState } from "react";
import {
  useInvoices, usePayments, useDiscounts,
  useCreateDiscount, useDeactivateDiscount, useConfirmPayment, useRejectPayment,
} from "@/hooks/use-api";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Check, X, Smartphone, Tag, Camera } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const dzd = (v: string | number) =>
  new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD", maximumFractionDigits: 0 })
    .format(Number(v));

function statusBadge(status: string) {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    confirmed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    rejected: "bg-red-500/10 text-red-600 border-red-500/30",
    cancelled: "bg-muted text-muted-foreground",
    overdue: "bg-red-500/10 text-red-600 border-red-500/30",
    draft: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

function methodIcon(method: string) {
  if (method === "baridimob") return <Smartphone className="w-3 h-3 inline mr-1 text-amber-500" />;
  return null;
}

export default function Billing() {
  const { toast } = useToast();
  const [invoicePage, setInvoicePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [discountPage, setDiscountPage] = useState(1);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [showCreateDiscount, setShowCreateDiscount] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const limit = 15;

  const { data: invoicesData, isLoading: isLoadingInvoices } = useInvoices(invoicePage, limit);
  const { data: paymentsData, isLoading: isLoadingPayments } = usePayments(
    paymentPage, limit, paymentStatusFilter, paymentMethodFilter
  );
  const { data: discountsData, isLoading: isLoadingDiscounts } = useDiscounts(discountPage, limit);

  const confirmPayment = useConfirmPayment();
  const rejectPayment = useRejectPayment();
  const deactivateDiscount = useDeactivateDiscount();
  const createDiscount = useCreateDiscount();

  const [newDiscount, setNewDiscount] = useState({
    code: "", type: "percent", value: "", maxUses: "", validFrom: "", validUntil: "", description: "",
  });

  const handleConfirm = (id: string) => {
    confirmPayment.mutate(id, {
      onSuccess: () => toast({ title: "Paiement confirmé" }),
      onError: () => toast({ title: "Erreur", description: "Impossible de confirmer", variant: "destructive" }),
    });
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    rejectPayment.mutate({ paymentId: rejectTarget, reason: rejectReason }, {
      onSuccess: () => { toast({ title: "Paiement rejeté" }); setRejectTarget(null); setRejectReason(""); },
      onError: () => toast({ title: "Erreur", description: "Impossible de rejeter", variant: "destructive" }),
    });
  };

  const handleCreateDiscount = () => {
    createDiscount.mutate({
      code: newDiscount.code.toUpperCase(),
      type: newDiscount.type,
      value: newDiscount.value,
      maxUses: newDiscount.maxUses ? Number(newDiscount.maxUses) : undefined,
      validFrom: newDiscount.validFrom || undefined,
      validUntil: newDiscount.validUntil || undefined,
      description: newDiscount.description || undefined,
    }, {
      onSuccess: () => {
        toast({ title: "Code créé avec succès" });
        setShowCreateDiscount(false);
        setNewDiscount({ code: "", type: "percent", value: "", maxUses: "", validFrom: "", validUntil: "", description: "" });
      },
      onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
    });
  };

  const pendingBaridimob = paymentsData?.data?.filter(
    (p: any) => p.status === "pending" && p.method === "baridimob"
  ).length ?? 0;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight">Facturation</h1>
        <p className="text-muted-foreground mt-1">Gérez les factures, paiements et codes de réduction.</p>
      </div>

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="invoices">Factures</TabsTrigger>
          <TabsTrigger value="payments" className="relative">
            Paiements
            {pendingBaridimob > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {pendingBaridimob}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="discounts">
            <Tag className="w-3.5 h-3.5 mr-1.5" />
            Codes promo
          </TabsTrigger>
        </TabsList>

        {/* ── Invoices ──────────────────────────────────────────────────── */}
        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {isLoadingInvoices ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Facture</TableHead>
                      <TableHead>Membre</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Échéance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoicesData?.data?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune facture trouvée.</TableCell>
                      </TableRow>
                    ) : (
                      invoicesData?.data?.map((inv: any) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium font-mono text-sm">{inv.invoiceNumber}</TableCell>
                          <TableCell>
                            <div className="font-medium">{inv.memberFirstName} {inv.memberLastName}</div>
                            <div className="text-xs text-muted-foreground">{inv.memberNumber}</div>
                          </TableCell>
                          <TableCell className="font-medium">{dzd(inv.total)}</TableCell>
                          <TableCell>{statusBadge(inv.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {inv.dueDate ? format(new Date(inv.dueDate), "d MMM yyyy") : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
              {(invoicesData?.totalPages ?? 0) > 1 && (
                <div className="flex justify-end gap-2 p-4 border-t">
                  <Button variant="outline" size="sm" disabled={invoicePage <= 1} onClick={() => setInvoicePage(p => p - 1)}>Précédent</Button>
                  <span className="flex items-center text-sm text-muted-foreground px-2">{invoicePage} / {invoicesData?.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={invoicePage >= (invoicesData?.totalPages ?? 1)} onClick={() => setInvoicePage(p => p + 1)}>Suivant</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Payments ──────────────────────────────────────────────────── */}
        <TabsContent value="payments" className="mt-6 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="confirmed">Confirmés</SelectItem>
                <SelectItem value="rejected">Rejetés</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Méthode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les méthodes</SelectItem>
                <SelectItem value="cash">Espèces</SelectItem>
                <SelectItem value="baridimob">Baridimob</SelectItem>
                <SelectItem value="cib">CIB</SelectItem>
                <SelectItem value="edahabia">Edahabia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingPayments ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Membre</TableHead>
                      <TableHead>Facture</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Méthode</TableHead>
                      <TableHead>Preuve</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentsData?.data?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun paiement trouvé.</TableCell>
                      </TableRow>
                    ) : (
                      paymentsData?.data?.map((p: any) => (
                        <TableRow key={p.id} className={p.status === "pending" && p.method === "baridimob" ? "bg-amber-500/5" : ""}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(p.createdAt), "d MMM yyyy HH:mm")}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{p.memberFirstName} {p.memberLastName}</div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{p.invoiceNumber ?? "—"}</TableCell>
                          <TableCell className="font-medium">{dzd(p.amount)}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1 text-sm capitalize">
                              {methodIcon(p.method)}
                              {p.method?.replace("_", " ")}
                            </span>
                          </TableCell>
                          <TableCell>
                            {p.proofUrl ? (
                              <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 text-sm">
                                <Camera className="w-3.5 h-3.5" /> Voir
                              </a>
                            ) : "—"}
                          </TableCell>
                          <TableCell>{statusBadge(p.status)}</TableCell>
                          <TableCell className="text-right">
                            {p.status === "pending" && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 border-emerald-500/50 text-emerald-600 hover:bg-emerald-50"
                                  onClick={() => handleConfirm(p.id)}
                                  disabled={confirmPayment.isPending}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 border-red-500/50 text-red-600 hover:bg-red-50"
                                  onClick={() => setRejectTarget(p.id)}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
              {(paymentsData?.totalPages ?? 0) > 1 && (
                <div className="flex justify-end gap-2 p-4 border-t">
                  <Button variant="outline" size="sm" disabled={paymentPage <= 1} onClick={() => setPaymentPage(p => p - 1)}>Précédent</Button>
                  <span className="flex items-center text-sm text-muted-foreground px-2">{paymentPage} / {paymentsData?.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={paymentPage >= (paymentsData?.totalPages ?? 1)} onClick={() => setPaymentPage(p => p + 1)}>Suivant</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Discounts ─────────────────────────────────────────────────── */}
        <TabsContent value="discounts" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowCreateDiscount(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nouveau code
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {isLoadingDiscounts ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Valeur</TableHead>
                      <TableHead>Utilisations</TableHead>
                      <TableHead>Validité</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discountsData?.data?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun code trouvé.</TableCell>
                      </TableRow>
                    ) : (
                      discountsData?.data?.map((d: any) => {
                        const isExpired = d.validUntil && new Date(d.validUntil) < new Date();
                        const isFull = d.maxUses && d.usesCount >= d.maxUses;
                        return (
                          <TableRow key={d.id}>
                            <TableCell className="font-mono font-bold text-sm">{d.code}</TableCell>
                            <TableCell className="capitalize">{d.type}</TableCell>
                            <TableCell>
                              {d.type === "percent" ? `${d.value}%` : dzd(d.value)}
                            </TableCell>
                            <TableCell>
                              <span className={isFull ? "text-red-500" : ""}>
                                {d.usesCount}{d.maxUses ? ` / ${d.maxUses}` : ""}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {d.validFrom && <div>Du {format(new Date(d.validFrom), "d MMM yyyy")}</div>}
                              {d.validUntil && (
                                <div className={isExpired ? "text-red-500" : ""}>
                                  Au {format(new Date(d.validUntil), "d MMM yyyy")}
                                </div>
                              )}
                              {!d.validFrom && !d.validUntil && "Illimité"}
                            </TableCell>
                            <TableCell>
                              {!d.isActive
                                ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">Inactif</span>
                                : isExpired
                                  ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-600">Expiré</span>
                                  : isFull
                                    ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-600">Épuisé</span>
                                    : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600">Actif</span>
                              }
                            </TableCell>
                            <TableCell className="text-right">
                              {d.isActive && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground h-7"
                                  onClick={() => deactivateDiscount.mutate(d.id)}
                                >
                                  Désactiver
                                </Button>
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
        </TabsContent>
      </Tabs>

      {/* ── Reject Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter le paiement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Motif du rejet (optionnel)</Label>
            <Input
              placeholder="Ex: Montant incorrect, virement non reçu..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectPayment.isPending}>
              {rejectPayment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Rejeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Discount Dialog ────────────────────────────────────── */}
      <Dialog open={showCreateDiscount} onOpenChange={setShowCreateDiscount}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un code promo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Code *</Label>
                <Input
                  placeholder="SUMMER2024"
                  value={newDiscount.code}
                  onChange={(e) => setNewDiscount(d => ({ ...d, code: e.target.value.toUpperCase() }))}
                  className="font-mono uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type *</Label>
                <Select value={newDiscount.type} onValueChange={(v) => setNewDiscount(d => ({ ...d, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Pourcentage (%)</SelectItem>
                    <SelectItem value="fixed">Montant fixe (DZD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valeur *</Label>
                <Input
                  type="number"
                  placeholder={newDiscount.type === "percent" ? "10" : "500"}
                  value={newDiscount.value}
                  onChange={(e) => setNewDiscount(d => ({ ...d, value: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Utilisations max</Label>
                <Input
                  type="number"
                  placeholder="Illimité"
                  value={newDiscount.maxUses}
                  onChange={(e) => setNewDiscount(d => ({ ...d, maxUses: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date de début</Label>
                <Input type="date" value={newDiscount.validFrom} onChange={(e) => setNewDiscount(d => ({ ...d, validFrom: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Date de fin</Label>
                <Input type="date" value={newDiscount.validUntil} onChange={(e) => setNewDiscount(d => ({ ...d, validUntil: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Description</Label>
                <Input placeholder="Description du code..." value={newDiscount.description} onChange={(e) => setNewDiscount(d => ({ ...d, description: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDiscount(false)}>Annuler</Button>
            <Button onClick={handleCreateDiscount} disabled={createDiscount.isPending || !newDiscount.code || !newDiscount.value}>
              {createDiscount.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
