import { useState } from "react";
import { useAccessLogs, useAccessPoints } from "@/hooks/use-api";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function Access() {
  const [page, setPage] = useState(1);
  const limit = 15;

  const { data: logsData, isLoading: isLoadingLogs } = useAccessLogs(page, limit);
  const { data: pointsData, isLoading: isLoadingPoints } = useAccessPoints();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">Access Control</h1>
          <p className="text-muted-foreground mt-1">Monitor club access logs and entry points.</p>
        </div>
      </div>

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">Access Logs</TabsTrigger>
          <TabsTrigger value="points">Access Points</TabsTrigger>
        </TabsList>
        
        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="relative">
                {isLoadingLogs ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Member</TableHead>
                        <TableHead>Access Point</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logsData?.data?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No logs found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        logsData?.data?.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm whitespace-nowrap">
                              {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                            </TableCell>
                            <TableCell className="font-medium">
                              {log.member?.firstName} {log.member?.lastName}
                            </TableCell>
                            <TableCell>{log.accessPoint?.name}</TableCell>
                            <TableCell>
                              <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                log.result === 'allowed' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                              }`}>
                                {log.result.toUpperCase()}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {log.denialReason || "-"}
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

        <TabsContent value="points" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="relative">
                {isLoadingPoints ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pointsData?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No access points found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pointsData?.map((point: any) => (
                          <TableRow key={point.id}>
                            <TableCell className="font-medium">{point.name}</TableCell>
                            <TableCell className="capitalize">{point.type}</TableCell>
                            <TableCell>
                              <Badge variant={point.isActive ? 'default' : 'secondary'}>
                                {point.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm">Configure</Button>
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
