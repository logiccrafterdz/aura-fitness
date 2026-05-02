import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { AppLayout } from "@/components/layout/app-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Members from "@/pages/members";
import MemberDetail from "@/pages/member-detail";
import Plans from "@/pages/plans";
import Memberships from "@/pages/memberships";
import Billing from "@/pages/billing";
import Access from "@/pages/access";
import Classes from "@/pages/classes";
import Staff from "@/pages/staff";
import Store from "@/pages/store";
import Notifications from "@/pages/notifications";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import Kiosk from "@/pages/kiosk";
import Portal from "@/pages/portal";
import FreezeRequests from "@/pages/freeze-requests";
import CashReconciliation from "@/pages/cash-reconciliation";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/kiosk" component={Kiosk} />
      <Route path="/portal/:memberNumber" component={Portal} />

      <Route path="/">
        <ProtectedRoute>
          <AppLayout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/members" component={Members} />
              <Route path="/members/:id" component={MemberDetail} />
              <Route path="/plans" component={Plans} />
              <Route path="/memberships" component={Memberships} />
              <Route path="/billing" component={Billing} />
              <Route path="/access" component={Access} />
              <Route path="/classes" component={Classes} />
              <Route path="/staff" component={Staff} />
              <Route path="/store" component={Store} />
              <Route path="/freeze-requests" component={FreezeRequests} />
              <Route path="/cash-reconciliation" component={CashReconciliation} />
              <Route path="/notifications" component={Notifications} />
              <Route path="/reports" component={Reports} />
              <Route path="/settings" component={Settings} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
