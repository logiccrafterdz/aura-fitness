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

// Billing
export function useInvoices(page: number, limit: number, status?: string, memberId?: string) {
  return useQuery({
    queryKey: ["invoices", page, limit, status, memberId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status && status !== "all") params.append("status", status);
      if (memberId) params.append("memberId", memberId);
      return api.get<any>(`/billing/invoices?${params.toString()}`);
    }
  });
}

export function usePayments(page: number, limit: number) {
  return useQuery({
    queryKey: ["payments", page, limit],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      return api.get<any>(`/billing/payments?${params.toString()}`);
    }
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post("/billing/payments", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
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
    }
  });
}

export function useAccessPoints() {
  return useQuery({
    queryKey: ["access-points"],
    queryFn: () => api.get<any>("/access/points"),
  });
}

// Classes
export function useClassTypes() {
  return useQuery({
    queryKey: ["class-types"],
    queryFn: () => api.get<any>("/classes/types"),
  });
}

export function useClassSessions(page: number, limit: number, classTypeId?: string, status?: string) {
  return useQuery({
    queryKey: ["class-sessions", page, limit, classTypeId, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (classTypeId && classTypeId !== "all") params.append("classTypeId", classTypeId);
      if (status && status !== "all") params.append("status", status);
      return api.get<any>(`/classes/sessions?${params.toString()}`);
    }
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
export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<any>("/store/products"),
  });
}

export function useOrders(page: number, limit: number) {
  return useQuery({
    queryKey: ["orders", page, limit],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
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
