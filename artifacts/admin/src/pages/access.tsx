import { useState } from "react";
import { useAccessLogs, useAccessPoints, useTimeRules } from "@/hooks/use-api";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, XCircle, Wifi, WifiOff, Clock, Shield } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const DENIAL_LABELS: Record<string, string> = {
  invalid_token: "Token invalide",
  member_inactive: "Membre inactif",
  no_active_membership: "Pas d'abonnement actif",
  membership_expired: "Abonnement expiré",
  zone_not_allowed: "Zone non autorisée",
  time_rule_violation: "Hors horaire autorisé",
};

const ZONE_COLORS: Record<string, string> = {
  main: "bg-blue-500/10 text-blue-600",
  cardio: "bg-emerald-500/10 text-emerald-600",
  weights: "bg-orange-500/10 text-orange-600",
  pool: "bg-cyan-500/10 text-cyan-600",
  vip: "bg-purple-500/10 text-purple-600",
};

export default function Access() {
  const [page, setPage] = useState(1);
  const [resultFilter, setResultFilter] = useState("all");
  const [accessPointFilter, setAccessPointFilter] = useState("all");
  const limit = 20;

  const { data: logsData, isLoading: isLoadingLogs } = useAccessLogs(
    page, limit, resultFilter, accessPointFilter
  );
  const { data: pointsData, isLoading: isLoadingPoints } = useAccessPoints();
  const { data: rulesData, isLoading: isLoadingRules } = useTimeRules();

  const now = new Date();
  const isOnline = (heartbeat: string | null) => {
    if (!heartbeat) return false;
    return (now.getTime() - new Date(heartbeat).getTime()) < 5 * 60 * 1000;
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight">Contrôle d'accès</h1>
        <p className="text-muted-foreground mt-1">Surveillez les journaux d'accès et les points d'entrée.</p>
      </div>

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">Journal d'accès</TabsTrigger>
          <TabsTrigger value="points">Points d'accès</TabsTrigger>
          <TabsTrigger value="rules">
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Règles horaires
          </TabsTrigger>
        </TabsList>

        {/* ── Access Logs ───────────────────────────────────────────────── */}
        <TabsContent value="logs" className="mt-6 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={resultFilter} onValueChange={(v) => { setResultFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Résultat" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les résultats</SelectItem>
                <SelectItem value="allowed">Autorisés</SelectItem>
                <SelectItem value="denied">Refusés</SelectItem>
              </SelectContent>
            </Select>
            <Select value={accessPointFilter} onValueChange={(v) => { setAccessPointFilter(v); setPage(1); }}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Point d'accès" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les points</SelectItem>
                {pointsData?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              Mise à jour automatique toutes les 15s
            </span>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingLogs ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Heure</TableHead>
                      <TableHead>Membre</TableHead>
                      <TableHead>Point d'accès</TableHead>
                      <TableHead>Résultat</TableHead>
                      <TableHead>Détail</TableHead>
                      <TableHead className="text-right">IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsData?.data?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun journal trouvé.</TableCell>
                      </TableRow>
                    ) : (
                      logsData?.data?.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm whitespace-nowrap font-mono">
                            {format(new Date(log.createdAt), "d MMM HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            {log.memberFirstName ? (
                              <div>
                                <div className="font-medium">{log.memberFirstName} {log.memberLastName}</div>
                                {log.memberNumber && <div className="text-xs text-muted-foreground">{log.memberNumber}</div>}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {log.accessPointName ? (
                              <span className="text-sm">{log.accessPointName}</span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
                              log.result === "allowed"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-red-500/10 text-red-600"
                            }`}>
                              {log.result === "allowed"
                                ? <CheckCircle className="w-3 h-3" />
                                : <XCircle className="w-3 h-3" />}
                              {log.result === "allowed" ? "Autorisé" : "Refusé"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {log.denialReason ? (DENIAL_LABELS[log.denialReason] ?? log.denialReason) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {log.ipAddress ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
              {(logsData?.totalPages ?? 0) > 1 && (
                <div className="flex justify-end gap-2 p-4 border-t">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Précédent</Button>
                  <span className="flex items-center text-sm text-muted-foreground px-2">{page} / {logsData?.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= (logsData?.totalPages ?? 1)} onClick={() => setPage(p => p + 1)}>Suivant</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Access Points ─────────────────────────────────────────────── */}
        <TabsContent value="points" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {isLoadingPoints ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Emplacement</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Connectivité</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!pointsData || pointsData.length === 0) ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun point d'accès trouvé.</TableCell>
                      </TableRow>
                    ) : (
                      pointsData.map((p: any) => {
                        const online = isOnline(p.lastHeartbeatAt);
                        return (
                          <TableRow key={p.id}>
                            <TableCell>
                              <div className="font-medium">{p.name}</div>
                              {p.hardwareId && <div className="text-xs text-muted-foreground font-mono">{p.hardwareId}</div>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{p.location ?? "—"}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                ZONE_COLORS[p.zone] ?? "bg-muted text-muted-foreground"
                              }`}>
                                {p.zone}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm capitalize">{p.type}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-xs">
                                {online
                                  ? <><Wifi className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-600">En ligne</span></>
                                  : p.lastHeartbeatAt
                                    ? <><WifiOff className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-muted-foreground">{formatDistanceToNow(new Date(p.lastHeartbeatAt), { locale: fr, addSuffix: true })}</span></>
                                    : <><WifiOff className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-muted-foreground">Jamais connecté</span></>
                                }
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={p.isActive ? "default" : "secondary"}>
                                {p.isActive ? "Actif" : "Inactif"}
                              </Badge>
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

        {/* ── Time Rules ────────────────────────────────────────────────── */}
        <TabsContent value="rules" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {isLoadingRules ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Règle</TableHead>
                      <TableHead>Horaire</TableHead>
                      <TableHead>Jours</TableHead>
                      <TableHead>Genre autorisé</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!rulesData || rulesData.length === 0) ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune règle configurée.</TableCell>
                      </TableRow>
                    ) : (
                      rulesData.map((r: any) => {
                        const days: number[] = r.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6];
                        const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
                        return (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <div className="font-medium">{r.name}</div>
                                  {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {r.startTime} — {r.endTime}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {days.map((d: number) => (
                                  <span key={d} className="text-xs bg-muted px-1.5 py-0.5 rounded">{DAY_NAMES[d]}</span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {r.allowedGender ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  r.allowedGender === "female"
                                    ? "bg-pink-500/10 text-pink-600"
                                    : "bg-blue-500/10 text-blue-600"
                                }`}>
                                  {r.allowedGender === "female" ? "Femmes" : "Hommes"} uniquement
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">Tous</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                ZONE_COLORS[r.zone ?? "main"] ?? "bg-muted text-muted-foreground"
                              }`}>
                                {r.zone ?? "main"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={r.isActive ? "default" : "secondary"}>
                                {r.isActive ? "Active" : "Inactive"}
                              </Badge>
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
    </div>
  );
}
