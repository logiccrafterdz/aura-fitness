import { useState } from "react";
import { useMemberByNumber } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, User, Calendar, CheckCircle2, AlertCircle, Clock, ShieldX } from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";

function MemberCard({ memberNumber }: { memberNumber: string }) {
  const { data, isLoading, error } = useMemberByNumber(memberNumber);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
        <CardContent className="pt-6 text-center">
          <ShieldX className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-700 dark:text-red-400 font-medium">Member not found</p>
          <p className="text-red-500/70 text-sm mt-1">
            Please check your member number and try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  const membership = data.activeMembership;
  const isActive = data.status === "active" && membership;
  const daysLeft = membership
    ? differenceInDays(new Date(membership.endDate), new Date())
    : null;
  const isExpired = membership ? isPast(new Date(membership.endDate)) : false;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold">
                {data.firstName} {data.lastName}
              </h2>
              {data.firstNameAr && (
                <p className="text-muted-foreground text-sm font-arabic" dir="rtl">
                  {data.firstNameAr} {data.lastNameAr}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground font-mono">
                  #{data.memberNumber}
                </span>
                <Badge
                  variant={data.status === "active" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {data.status}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Membership Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isActive && membership && !isExpired ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    Active Membership
                  </p>
                  <p className="text-emerald-600/70 text-sm">
                    You have full access to AURA Fitness Club
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="font-semibold mt-0.5">{membership.planName}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Expires</p>
                  <p className="font-semibold mt-0.5">
                    {format(new Date(membership.endDate), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              {daysLeft !== null && daysLeft <= 14 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-amber-700 dark:text-amber-400 text-sm">
                    {daysLeft <= 0
                      ? "Your membership expires today!"
                      : `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining — renew soon`}
                  </p>
                </div>
              )}
              {daysLeft !== null && daysLeft > 14 && (
                <p className="text-sm text-muted-foreground text-center">
                  {daysLeft} days remaining
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground/40" />
              <div>
                <p className="font-medium text-muted-foreground">No Active Membership</p>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  Please visit the front desk to renew your membership.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-center text-xs text-muted-foreground">
            For assistance, please visit the front desk or call{" "}
            <span className="font-medium text-foreground">+213 XX XX XX XX</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Portal() {
  const [input, setInput] = useState("");
  const [memberNumber, setMemberNumber] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = input.trim().toUpperCase();
    if (cleaned) setMemberNumber(cleaned);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-primary-foreground text-xs font-bold">A</span>
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">AURA Fitness</p>
            <p className="text-xs text-muted-foreground leading-none mt-0.5">
              Member Portal
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Membership</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Enter your member number to view your status.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. AUR-000042"
              className="w-full pl-9 pr-3 py-2.5 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Search
          </button>
        </form>

        {memberNumber && <MemberCard memberNumber={memberNumber} />}

        {!memberNumber && (
          <div className="text-center py-12 text-muted-foreground/40">
            <User className="w-12 h-12 mx-auto mb-3" />
            <p className="text-sm">Enter your member number to get started</p>
          </div>
        )}
      </main>

      <footer className="border-t bg-muted/30 py-4">
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} AURA Fitness Club · All rights reserved
        </p>
      </footer>
    </div>
  );
}
