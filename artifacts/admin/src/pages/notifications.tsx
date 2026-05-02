import { useState } from "react";
import {
  useNotificationTemplates,
  useNotificationRecords,
  useSendNotification,
  useMembers,
} from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Send, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const channelColor: Record<string, string> = {
  push: "bg-blue-100 text-blue-800",
  sms: "bg-purple-100 text-purple-800",
  email: "bg-orange-100 text-orange-800",
};

const statusColor: Record<string, string> = {
  queued: "bg-yellow-100 text-yellow-800",
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  delivered: "bg-emerald-100 text-emerald-800",
};

export default function Notifications() {
  const [tab, setTab] = useState("templates");
  const [page, setPage] = useState(1);
  const [sendDialog, setSendDialog] = useState(false);
  const [sendForm, setSendForm] = useState({ eventTrigger: "", memberId: "", language: "ar" as "ar" | "fr" });
  const [memberSearch, setMemberSearch] = useState("");
  const limit = 15;
  const { toast } = useToast();

  const { data: templates, isLoading: templatesLoading } = useNotificationTemplates();
  const { data: records, isLoading: recordsLoading } = useNotificationRecords(page, limit);
  const { data: membersData } = useMembers(1, 20, memberSearch);
  const sendMutation = useSendNotification();

  const rows = records?.data ?? [];
  const total = records?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const handleSend = async () => {
    if (!sendForm.eventTrigger || !sendForm.memberId) return;
    try {
      const result = await sendMutation.mutateAsync({
        eventTrigger: sendForm.eventTrigger,
        memberId: sendForm.memberId,
        language: sendForm.language,
      });
      toast({ title: "Notification sent", description: `${(result as any).sent} message(s) queued.` });
      setSendDialog(false);
      setSendForm({ eventTrigger: "", memberId: "", language: "ar" });
      setMemberSearch("");
    } catch {
      toast({ title: "Error", description: "Failed to send notification.", variant: "destructive" });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Bell className="w-7 h-7 text-blue-500" />
            <h1 className="text-3xl font-serif font-bold tracking-tight">Notifications</h1>
          </div>
          <p className="text-muted-foreground mt-1">Manage communication templates and send manual notifications.</p>
        </div>
        <Button onClick={() => setSendDialog(true)}>
          <Send className="w-4 h-4 mr-2" />
          Send Notification
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="records">Sent Records</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {templatesLoading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Trigger Event</TableHead>
                      <TableHead>Title (AR)</TableHead>
                      <TableHead>Title (FR)</TableHead>
                      <TableHead>Channels</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Quick Send</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No templates found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      templates?.map((t: any) => (
                        <TableRow key={t.id}>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{t.key}</code>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.eventTrigger}</TableCell>
                          <TableCell className="text-sm font-arabic max-w-[160px] truncate" dir="rtl">
                            {t.titleAr}
                          </TableCell>
                          <TableCell className="text-sm max-w-[160px] truncate">{t.titleFr}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {((t.channels ?? []) as string[]).map((ch) => (
                                <Badge key={ch} className={`text-xs ${channelColor[ch] ?? ""}`}>{ch}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={t.isActive ? "default" : "secondary"}>
                              {t.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSendForm(f => ({ ...f, eventTrigger: t.eventTrigger }));
                                setSendDialog(true);
                              }}
                            >
                              <Send className="w-3.5 h-3.5 mr-1" />
                              Send
                            </Button>
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

        <TabsContent value="records" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {recordsLoading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No notification records yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((rec: any) => (
                        <TableRow key={rec.id}>
                          <TableCell className="font-medium">
                            {rec.memberFirstName} {rec.memberLastName}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{rec.templateKey ?? "–"}</code>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${channelColor[rec.channel] ?? ""}`}>{rec.channel}</Badge>
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{rec.title}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${statusColor[rec.status] ?? ""}`}>{rec.status}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {rec.createdAt ? format(new Date(rec.createdAt), "dd/MM/yyyy HH:mm") : "–"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
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
        </TabsContent>
      </Tabs>

      {/* Send Notification Dialog */}
      <Dialog open={sendDialog} onOpenChange={(o) => { if (!o) { setSendDialog(false); setSendForm({ eventTrigger: "", memberId: "", language: "ar" }); setMemberSearch(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Event Trigger *</Label>
              <Select value={sendForm.eventTrigger} onValueChange={(v) => setSendForm(f => ({ ...f, eventTrigger: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((t: any) => (
                    <SelectItem key={t.id} value={t.eventTrigger}>
                      {t.key} — {t.eventTrigger}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Member *</Label>
              <Input
                placeholder="Search member name..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
              {membersData?.data?.length > 0 && memberSearch && (
                <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
                  {membersData.data.map((m: any) => (
                    <button
                      key={m.id}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${sendForm.memberId === m.id ? "bg-accent" : ""}`}
                      onClick={() => {
                        setSendForm(f => ({ ...f, memberId: m.id }));
                        setMemberSearch(`${m.firstName} ${m.lastName}`);
                      }}
                    >
                      <span className="font-medium">{m.firstName} {m.lastName}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{m.memberNumber}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select value={sendForm.language} onValueChange={(v) => setSendForm(f => ({ ...f, language: v as "ar" | "fr" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">Arabic (العربية)</SelectItem>
                  <SelectItem value="fr">French (Français)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSendDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSend}
              disabled={sendMutation.isPending || !sendForm.eventTrigger || !sendForm.memberId}
            >
              {sendMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Send className="w-4 h-4 mr-2" />
              Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
