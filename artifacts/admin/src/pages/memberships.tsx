import { useState } from "react";
import { useMemberships, usePlans } from "@/hooks/use-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function Memberships() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [planId, setPlanId] = useState("all");
  const limit = 10;

  const { data: plansData } = usePlans();
  const { data, isLoading } = useMemberships(page, limit, undefined, status, planId);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">Memberships</h1>
          <p className="text-muted-foreground mt-1">Manage active and inactive memberships.</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Membership
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b flex items-center gap-4">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="frozen">Frozen</SelectItem>
              </SelectContent>
            </Select>

            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                {plansData?.data?.map((plan: any) => (
                  <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
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
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No memberships found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.data?.map((membership: any) => (
                      <TableRow key={membership.id}>
                        <TableCell className="font-medium">
                          {membership.firstName} {membership.lastName}
                        </TableCell>
                        <TableCell>{membership.planName}</TableCell>
                        <TableCell>
                          <Badge variant={membership.status === 'active' ? 'default' : 'secondary'}>
                            {membership.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(membership.startDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(membership.endDate), "MMM d, yyyy")}
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
          
          <div className="p-4 border-t flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {data?.data?.length || 0} of {data?.total || 0} memberships
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                disabled={page === (data?.totalPages || 1)}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
