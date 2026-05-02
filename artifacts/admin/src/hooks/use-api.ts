import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// Members
export function useMembers(page: number, limit: number, search: string, status?: string, gender?: string) {
  return useQuery({
    queryKey: ["members", page, limit, search, status, gender],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.append("search", search);
      if (status && status !== "all") params.append("status", status);
      if (gender && gender !== "all") params.append("gender", gender);
      return api.get<any>(`/members?${params.toString()}`);
    }
  });
}

export function useMember(id: string) {
  return useQuery({
    queryKey: ["members", id],
    queryFn: () => api.get<any>(`/members/${id}`),
    enabled: !!id
  });
}

export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post("/members", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}

export function useUpdateMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.patch(`/members/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["members", id] });
    },
  });
}

// Dashboard
export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<any>("/reports/dashboard"),
    refetchInterval: 60000,
  });
}

// Plans
export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<any>("/plans"),
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post("/plans", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });
}

export function useUpdatePlan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.patch(`/plans/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });
}

// Memberships
export function useMemberships(page: number, limit: number, memberId?: string, status?: string, planId?: string) {
  return useQuery({
    queryKey: ["memberships", page, limit, memberId, status, planId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (memberId) params.append("memberId", memberId);
      if (status && status !== "all") params.append("status", status);
      if (planId && planId !== "all") params.append("planId", planId);
      return api.get<any>(`/memberships?${params.toString()}`);
    }
  });
}

export function useCreateMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post("/memberships", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memberships"] }),
  });
}

// Billing — Invoices
export function useInvoices(page: number, limit: number, status?: string, memberId?: string) {
  return useQuery({
    queryKey: ["invoices", page, limit, status, memberId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status && status !== "all") params.append("status", status);
      if (memberId) params.append("memberId", memberId);
      return api.get<any>(`/invoices?${params.toString()}`);
    }
  });
}

// Billing — Payments
export function usePayments(page: number, limit: number, status?: string, method?: string) {
  return useQuery({
    queryKey: ["payments", page, limit, status, method],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status && status !== "all") params.append("status", status);
      if (method && method !== "all") params.append("method", method);
      return api.get<any>(`/payments?${params.toString()}`);
    },
    refetchInterval: 30000,
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, body }: { invoiceId: string; body: any }) =>
      api.post(`/invoices/${invoiceId}/payments`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useConfirmPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => api.patch(`/payments/${paymentId}/confirm`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useRejectPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason?: string }) =>
      api.patch(`/payments/${paymentId}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// Billing — Discounts
export function useDiscounts(page: number, limit: number) {
  return useQuery({
    queryKey: ["discounts", page, limit],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      return api.get<any>(`/discounts?${params.toString()}`);
    }
  });
}

export function useCreateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post("/discounts", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discounts"] }),
  });
}

export function useUpdateDiscount(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.patch(`/discounts/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discounts"] }),
  });
}

export function useDeactivateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/discounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discounts"] }),
  });
}

export function useValidateDiscount() {
  return useMutation({
    mutationFn: (body: { code: string; amount?: string }) =>
      api.post<any>("/discounts/validate", body),
  });
}

// Access
export function useAccessLogs(page: number, limit: number, result?: string, accessPointId?: string) {
  return useQuery({
    queryKey: ["access-logs", page, limit, result, accessPointId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (result && result !== "all") params.append("result", result);
      if (accessPointId && accessPointId !== "all") params.append("accessPointId", accessPointId);
      return api.get<any>(`/access/logs?${params.toString()}`);
    },
    refetchInterval: 15000,
  });
}

export function useAccessPoints() {
  return useQuery({
    queryKey: ["access-points"],
    queryFn: () => api.get<any>("/access/points"),
    refetchInterval: 30000,
  });
}

export function useTimeRules() {
  return useQuery({
    queryKey: ["time-rules"],
    queryFn: () => api.get<any>("/access/time-rules"),
  });
}

export function useCreateAccessPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post("/access/points", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["access-points"] }),
  });
}

// Classes
export function useClassTypes() {
  return useQuery({
    queryKey: ["class-types"],
    queryFn: () => api.get<any>("/class-types"),
  });
}

export function useClassSessions(page: number, limit: number, classTypeId?: string, status?: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ["class-sessions", page, limit, classTypeId, status, from, to],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (classTypeId && classTypeId !== "all") params.append("classTypeId", classTypeId);
      if (status && status !== "all") params.append("status", status);
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      return api.get<any>(`/class-sessions?${params.toString()}`);
    }
  });
}

export function useCreateClassSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post("/class-sessions", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-sessions"] }),
  });
}

export function useCreateRecurringSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post<any>("/class-sessions/recurring", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-sessions"] }),
  });
}

export function useCreateClassType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post("/class-types", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-types"] }),
  });
}

export function useBookings(page: number, limit: number, sessionId?: string, memberId?: string) {
  return useQuery({
    queryKey: ["bookings", page, limit, sessionId, memberId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (sessionId) params.append("sessionId", sessionId);
      if (memberId) params.append("memberId", memberId);
      return api.get<any>(`/bookings?${params.toString()}`);
    },
    enabled: !!(sessionId || memberId),
  });
}

// Staff
export function useStaff(page: number, limit: number, role?: string, search?: string) {
  return useQuery({
    queryKey: ["staff", page, limit, role, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (role && role !== "all") params.append("role", role);
      if (search) params.append("search", search);
      return api.get<any>(`/staff?${params.toString()}`);
    }
  });
}

// Store
export function useProducts(page?: number, limit?: number, category?: string) {
  return useQuery({
    queryKey: ["products", page, limit, category],
    queryFn: () => {
      const params = new URLSearchParams();
      if (page) params.append("page", String(page));
      if (limit) params.append("limit", String(limit));
      if (category && category !== "all") params.append("category", category);
      return api.get<any>(`/store/products?${params.toString()}`);
    }
  });
}

export function useOrders(page: number, limit: number, status?: string) {
  return useQuery({
    queryKey: ["orders", page, limit, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status && status !== "all") params.append("status", status);
      return api.get<any>(`/store/orders?${params.toString()}`);
    }
  });
}

// Notifications
export function useNotificationTemplates() {
  return useQuery({
    queryKey: ["notification-templates"],
    queryFn: () => api.get<any>("/notifications/templates"),
  });
}

// Reports
export function useRevenueReport(from?: string, to?: string, groupBy: string = "day") {
  return useQuery({
    queryKey: ["reports-revenue", from, to, groupBy],
    queryFn: () => {
      const params = new URLSearchParams({ groupBy });
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      return api.get<any>(`/reports/revenue?${params.toString()}`);
    }
  });
}

export function useMembersReport(from?: string, to?: string) {
  return useQuery({
    queryKey: ["reports-members", from, to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      return api.get<any>(`/reports/members?${params.toString()}`);
    }
  });
}

export function useAccessReport(from?: string, to?: string) {
  return useQuery({
    queryKey: ["reports-access", from, to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      return api.get<any>(`/reports/access?${params.toString()}`);
    }
  });
}

export function useClassesReport(from?: string) {
  return useQuery({
    queryKey: ["reports-classes", from],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.append("from", from);
      return api.get<any>(`/reports/classes?${params.toString()}`);
    }
  });
}

export function useStoreReport(from?: string) {
  return useQuery({
    queryKey: ["reports-store", from],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.append("from", from);
      return api.get<any>(`/reports/store?${params.toString()}`);
    }
  });
}

// Settings
export function useSettingsConfig() {
  return useQuery({
    queryKey: ["settings-config"],
    queryFn: () => api.get<any>("/settings/config"),
  });
}

export function useAuditLogs(page: number, limit: number) {
  return useQuery({
    queryKey: ["audit-logs", page, limit],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      return api.get<any>(`/audit/logs?${params.toString()}`);
    }
  });
}
