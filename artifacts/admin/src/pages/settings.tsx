import { useState } from "react";
import { useSettingsConfig, useAuditLogs } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function Settings() {
  const [page, setPage] = useState(1);
  const limit = 15;

  const { data: configData, isLoading: isLoadingConfig } = useSettingsConfig();
  const { data: auditData, isLoading: isLoadingAudit } = useAuditLogs(page, limit);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">System configuration and audit logs.</p>
        </div>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="config" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingConfig ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {configData && Object.entries(configData).map(([key, value]) => (
                      <div key={key} className="flex flex-col space-y-1">
                        <span className="font-medium text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="relative">
                {isLoadingAudit ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditData?.data?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No audit logs found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditData?.data?.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm whitespace-nowrap">
                              {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                            </TableCell>
                            <TableCell className="font-medium">
                              {log.user?.firstName} {log.user?.lastName}
                            </TableCell>
                            <TableCell>
                              <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground uppercase">
                                {log.action}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {log.resource}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
