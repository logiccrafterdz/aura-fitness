import { useState } from "react";
import { useClassSessions, useClassTypes } from "@/hooks/use-api";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { format } from "date-fns";

export default function Classes() {
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: sessionsData, isLoading: isLoadingSessions } = useClassSessions(page, limit);
  const { data: typesData, isLoading: isLoadingTypes } = useClassTypes();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground mt-1">Manage class types and scheduled sessions.</p>
        </div>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="types">Class Types</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sessions" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b flex justify-end">
                <Button>
                  <Plus className="w-4 h-4 mr-2" /> New Session
                </Button>
              </div>
              <div className="relative">
                {isLoadingSessions ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead>Instructor</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Bookings</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionsData?.data?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No sessions found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        sessionsData?.data?.map((session: any) => (
                          <TableRow key={session.id}>
                            <TableCell className="font-medium">{session.classType?.name}</TableCell>
                            <TableCell>{session.classType?.instructor}</TableCell>
                            <TableCell className="text-sm">
                              <div>{format(new Date(session.startsAt), "MMM d, yyyy")}</div>
                              <div className="text-muted-foreground">
                                {format(new Date(session.startsAt), "HH:mm")} - {format(new Date(session.endsAt), "HH:mm")}
                              </div>
                            </TableCell>
                            <TableCell>
                              {session.currentBookings} / {session.maxCapacity}
                            </TableCell>
                            <TableCell>
                              <Badge variant={session.status === 'scheduled' ? 'default' : 'secondary'}>
                                {session.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm">Manage</Button>
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

        <TabsContent value="types" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b flex justify-end">
                <Button>
                  <Plus className="w-4 h-4 mr-2" /> New Class Type
                </Button>
              </div>
              <div className="relative">
                {isLoadingTypes ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Default Capacity</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {typesData?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No class types found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        typesData?.map((type: any) => (
                          <TableRow key={type.id}>
                            <TableCell className="font-medium">{type.name}</TableCell>
                            <TableCell>{type.duration} min</TableCell>
                            <TableCell>{type.capacity}</TableCell>
                            <TableCell className="capitalize">{type.level}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm">Edit</Button>
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
