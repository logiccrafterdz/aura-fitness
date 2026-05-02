import { useMember } from "@/hooks/use-api";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function MemberDetail() {
  const { id } = useParams();
  const { data: member, isLoading } = useMember(id as string);

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!member) {
    return <div className="p-8">Member not found.</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-serif font-bold tracking-tight">
              {member.firstName} {member.lastName}
            </h1>
            <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
              {member.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">Member #{member.memberNumber}</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="memberships">Memberships</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="access">Access Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Email</div>
                    <div>{member.email}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Phone</div>
                    <div>{member.phone}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Gender</div>
                    <div className="capitalize">{member.gender}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Joined</div>
                    <div>{format(new Date(member.createdAt), "MMM d, yyyy")}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Membership</CardTitle>
              </CardHeader>
              <CardContent>
                {member.activeMembership ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Plan</div>
                      <div className="font-medium">{member.activeMembership.planName}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Valid Until</div>
                      <div>{format(new Date(member.activeMembership.endDate), "MMM d, yyyy")}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground py-4">No active membership</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* Other tabs would go here */}
      </Tabs>
    </div>
  );
}
