import { useState } from "react";
import {
  useClassSessions, useClassTypes,
  useCreateClassType, useCreateRecurringSessions,
} from "@/hooks/use-api";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, RefreshCw, Users } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    scheduled: "bg-blue-500/10 text-blue-600",
    ongoing: "bg-emerald-500/10 text-emerald-600",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-red-500/10 text-red-600",
  };
  const labels: Record<string, string> = {
    scheduled: "Planifié",
    ongoing: "En cours",
    completed: "Terminé",
    cancelled: "Annulé",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function Classes() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [classTypeFilter, setClassTypeFilter] = useState("all");
  const [showRecurring, setShowRecurring] = useState(false);
  const [showNewType, setShowNewType] = useState(false);
  const limit = 15;

  const { data: sessionsData, isLoading: isLoadingSessions } = useClassSessions(
    page, limit, classTypeFilter, statusFilter
  );
  const { data: typesData, isLoading: isLoadingTypes } = useClassTypes();

  const createRecurring = useCreateRecurringSessions();
  const createClassType = useCreateClassType();

  const [recurring, setRecurring] = useState({
    classTypeId: "",
    startDate: "",
    endDate: "",
    startTime: "09:00",
    endTime: "10:00",
    daysOfWeek: [] as number[],
    room: "",
    maxCapacity: "",
  });

  const [newType, setNewType] = useState({
    name: "", nameAr: "", durationMinutes: "60", maxCapacity: "20",
    difficultyLevel: "all", color: "#6366f1", description: "",
  });

  const handleRecurring = () => {
    if (!recurring.classTypeId || !recurring.startDate || !recurring.endDate || recurring.daysOfWeek.length === 0) {
      toast({ title: "Champs manquants", description: "Veuillez remplir tous les champs obligatoires.", variant: "destructive" });
      return;
    }
    createRecurring.mutate({
      classTypeId: recurring.classTypeId,
      startDate: recurring.startDate,
      endDate: recurring.endDate,
      startTime: recurring.startTime,
      endTime: recurring.endTime,
      daysOfWeek: recurring.daysOfWeek,
      room: recurring.room || undefined,
      maxCapacity: recurring.maxCapacity ? Number(recurring.maxCapacity) : undefined,
    }, {
      onSuccess: (data: any) => {
        toast({ title: `${data.count} séances créées avec succès` });
        setShowRecurring(false);
      },
      onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
    });
  };

  const handleCreateType = () => {
    createClassType.mutate({
      name: newType.name,
      nameAr: newType.nameAr || undefined,
      durationMinutes: Number(newType.durationMinutes),
      maxCapacity: Number(newType.maxCapacity),
      difficultyLevel: newType.difficultyLevel,
      color: newType.color,
      description: newType.description || undefined,
    }, {
      onSuccess: () => { toast({ title: "Type de cours créé" }); setShowNewType(false); },
      onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
    });
  };

  const toggleDay = (day: number) => {
    setRecurring(r => ({
      ...r,
      daysOfWeek: r.daysOfWeek.includes(day)
        ? r.daysOfWeek.filter(d => d !== day)
        : [...r.daysOfWeek, day].sort(),
    }));
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight">Cours</h1>
        <p className="text-muted-foreground mt-1">Gérez les types de cours et les séances planifiées.</p>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">Séances</TabsTrigger>
          <TabsTrigger value="types">Types de cours</TabsTrigger>
        </TabsList>

        {/* ── Sessions ──────────────────────────────────────────────────── */}
        <TabsContent value="sessions" className="mt-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="scheduled">Planifiés</SelectItem>
                  <SelectItem value="ongoing">En cours</SelectItem>
                  <SelectItem value="completed">Terminés</SelectItem>
                  <SelectItem value="cancelled">Annulés</SelectItem>
                </SelectContent>
              </Select>
              <Select value={classTypeFilter} onValueChange={setClassTypeFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Type de cours" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les cours</SelectItem>
                  {typesData?.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowRecurring(true)}>
                <RefreshCw className="w-4 h-4 mr-2" /> Séances récurrentes
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingSessions ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cours</TableHead>
                      <TableHead>Salle</TableHead>
                      <TableHead>Date & Heure</TableHead>
                      <TableHead>Remplissage</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionsData?.data?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune séance trouvée.</TableCell>
                      </TableRow>
                    ) : (
                      sessionsData?.data?.map((s: any) => {
                        const bookings = s.currentBookings ?? 0;
                        const capacity = s.maxCapacity ?? 1;
                        const fill = Math.round((bookings / capacity) * 100);
                        return (
                          <TableRow key={s.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {s.classColor && (
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.classColor }} />
                                )}
                                <div>
                                  <div className="font-medium">{s.className}</div>
                                  {s.trainerFirstName && (
                                    <div className="text-xs text-muted-foreground">{s.trainerFirstName} {s.trainerLastName}</div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{s.room ?? "—"}</TableCell>
                            <TableCell className="text-sm">
                              <div className="font-medium">{format(new Date(s.startsAt), "EEE d MMM")}</div>
                              <div className="text-muted-foreground">
                                {format(new Date(s.startsAt), "HH:mm")} — {format(new Date(s.endsAt), "HH:mm")}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-[120px]">
                                <Progress value={fill} className="h-1.5 flex-1" />
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {bookings}/{capacity}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{statusBadge(s.status)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
              {(sessionsData?.totalPages ?? 0) > 1 && (
                <div className="flex justify-end gap-2 p-4 border-t">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Précédent</Button>
                  <span className="flex items-center text-sm text-muted-foreground px-2">{page} / {sessionsData?.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= (sessionsData?.totalPages ?? 1)} onClick={() => setPage(p => p + 1)}>Suivant</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Class Types ───────────────────────────────────────────────── */}
        <TabsContent value="types" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowNewType(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nouveau type
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {isLoadingTypes ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Durée</TableHead>
                      <TableHead>Capacité</TableHead>
                      <TableHead>Niveau</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!typesData || typesData.length === 0) ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucun type trouvé.</TableCell>
                      </TableRow>
                    ) : (
                      typesData.map((t: any) => (
                        <TableRow key={t.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {t.color && <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />}
                              <div>
                                <div className="font-medium">{t.name}</div>
                                {t.nameAr && <div className="text-xs text-muted-foreground" dir="rtl">{t.nameAr}</div>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{t.durationMinutes} min</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Users className="w-3.5 h-3.5 text-muted-foreground" />
                              {t.maxCapacity}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize text-xs">{t.difficultyLevel ?? "—"}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Recurring Sessions Dialog ─────────────────────────────────── */}
      <Dialog open={showRecurring} onOpenChange={setShowRecurring}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Créer des séances récurrentes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Type de cours *</Label>
              <Select value={recurring.classTypeId} onValueChange={(v) => setRecurring(r => ({ ...r, classTypeId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir un cours" /></SelectTrigger>
                <SelectContent>
                  {typesData?.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date de début *</Label>
                <Input type="date" value={recurring.startDate} onChange={(e) => setRecurring(r => ({ ...r, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Date de fin *</Label>
                <Input type="date" value={recurring.endDate} onChange={(e) => setRecurring(r => ({ ...r, endDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Heure de début *</Label>
                <Input type="time" value={recurring.startTime} onChange={(e) => setRecurring(r => ({ ...r, startTime: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Heure de fin *</Label>
                <Input type="time" value={recurring.endTime} onChange={(e) => setRecurring(r => ({ ...r, endTime: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Jours de la semaine *</Label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((day, i) => (
                  <label key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border cursor-pointer text-sm transition-colors ${
                    recurring.daysOfWeek.includes(i)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-accent"
                  }`}>
                    <Checkbox
                      checked={recurring.daysOfWeek.includes(i)}
                      onCheckedChange={() => toggleDay(i)}
                      className="hidden"
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Salle</Label>
                <Input placeholder="Ex: Salle A" value={recurring.room} onChange={(e) => setRecurring(r => ({ ...r, room: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Capacité max</Label>
                <Input type="number" placeholder="Par défaut du cours" value={recurring.maxCapacity} onChange={(e) => setRecurring(r => ({ ...r, maxCapacity: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecurring(false)}>Annuler</Button>
            <Button onClick={handleRecurring} disabled={createRecurring.isPending}>
              {createRecurring.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création...</>
                : <><RefreshCw className="w-4 h-4 mr-2" />Créer les séances</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Class Type Dialog ─────────────────────────────────────── */}
      <Dialog open={showNewType} onOpenChange={setShowNewType}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau type de cours</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nom (français) *</Label>
                <Input placeholder="Ex: Yoga, CrossFit..." value={newType.name} onChange={(e) => setNewType(t => ({ ...t, name: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Nom (arabe)</Label>
                <Input dir="rtl" placeholder="مثال: يوغا" value={newType.nameAr} onChange={(e) => setNewType(t => ({ ...t, nameAr: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Durée (min)</Label>
                <Input type="number" value={newType.durationMinutes} onChange={(e) => setNewType(t => ({ ...t, durationMinutes: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Capacité max</Label>
                <Input type="number" value={newType.maxCapacity} onChange={(e) => setNewType(t => ({ ...t, maxCapacity: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Niveau</Label>
                <Select value={newType.difficultyLevel} onValueChange={(v) => setNewType(t => ({ ...t, difficultyLevel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Débutant</SelectItem>
                    <SelectItem value="intermediate">Intermédiaire</SelectItem>
                    <SelectItem value="advanced">Avancé</SelectItem>
                    <SelectItem value="all">Tous niveaux</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Couleur</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={newType.color} onChange={(e) => setNewType(t => ({ ...t, color: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border border-border" />
                  <span className="text-sm text-muted-foreground font-mono">{newType.color}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewType(false)}>Annuler</Button>
            <Button onClick={handleCreateType} disabled={createClassType.isPending || !newType.name}>
              {createClassType.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
