import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiUpload } from "./api";
import type {
  MeResponse,
  DriverBalance,
  ReportSummary,
  ReminderItem,
} from "@taxi/shared";
import type {
  Agreement,
  Car,
  Driver,
  Expense,
  Fine,
  Shift,
  DocumentItem,
  OwnerRow,
  Payment,
} from "./types";
import { isImageDocument } from "./components/documentUtils";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => apiFetch<MeResponse>("/me") });
}

export function useSetLocale() {
  return useMutation({
    mutationFn: (locale: string) =>
      apiFetch("/me/locale", { method: "PATCH", body: { locale } }),
  });
}

// --- Cars -------------------------------------------------------------------
export function useCars() {
  return useQuery({ queryKey: ["cars"], queryFn: () => apiFetch<Car[]>("/cars") });
}
export function useSaveCar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; data: Record<string, unknown> }) =>
      input.id
        ? apiFetch<Car>(`/cars/${input.id}`, { method: "PATCH", body: input.data })
        : apiFetch<Car>("/cars", { method: "POST", body: input.data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cars"] });
      void qc.invalidateQueries({ queryKey: ["reminders"] });
      void qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}
export function useDeleteCar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/cars/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["cars"] }),
  });
}

// --- Drivers ----------------------------------------------------------------
export function useDrivers() {
  return useQuery({ queryKey: ["drivers"], queryFn: () => apiFetch<Driver[]>("/drivers") });
}
export function useDriver(id: string | undefined) {
  return useQuery({
    queryKey: ["drivers", id],
    queryFn: () => apiFetch<Driver>(`/drivers/${id}`),
    enabled: Boolean(id),
  });
}
export function useSaveDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; data: Record<string, unknown> }) =>
      input.id
        ? apiFetch(`/drivers/${input.id}`, { method: "PATCH", body: input.data })
        : apiFetch("/drivers", { method: "POST", body: input.data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["drivers"] });
      void qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}
export function useDeleteDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/drivers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["drivers"] });
      void qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

// --- Agreements -------------------------------------------------------------
export function useAgreements(params?: { driverId?: string }) {
  return useQuery({
    queryKey: ["agreements", params],
    queryFn: () => apiFetch<Agreement[]>("/agreements", { query: params }),
  });
}
export function useCreateAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch("/agreements", { method: "POST", body: data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agreements"] });
      void qc.invalidateQueries({ queryKey: ["drivers"] });
      void qc.invalidateQueries({ queryKey: ["cars"] });
      void qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}
export function useEndAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/agreements/${id}/end`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agreements"] });
      void qc.invalidateQueries({ queryKey: ["drivers"] });
      void qc.invalidateQueries({ queryKey: ["cars"] });
      void qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

// --- Payments ---------------------------------------------------------------
export function usePayments() {
  return useQuery({ queryKey: ["payments"], queryFn: () => apiFetch<Payment[]>("/payments") });
}
export function useSavePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; data: Record<string, unknown> }) =>
      input.id
        ? apiFetch(`/payments/${input.id}`, { method: "PATCH", body: input.data })
        : apiFetch("/payments", { method: "POST", body: input.data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payments"] });
      void qc.invalidateQueries({ queryKey: ["balances"] });
      void qc.invalidateQueries({ queryKey: ["report"] });
    },
  });
}
export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/payments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payments"] });
      void qc.invalidateQueries({ queryKey: ["balances"] });
      void qc.invalidateQueries({ queryKey: ["report"] });
    },
  });
}

// --- Expenses ---------------------------------------------------------------
export function useExpenses() {
  return useQuery({ queryKey: ["expenses"], queryFn: () => apiFetch<Expense[]>("/expenses") });
}
export function useSaveExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; data: Record<string, unknown> }) =>
      input.id
        ? apiFetch(`/expenses/${input.id}`, { method: "PATCH", body: input.data })
        : apiFetch("/expenses", { method: "POST", body: input.data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["expenses"] });
      void qc.invalidateQueries({ queryKey: ["report"] });
    },
  });
}
export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["expenses"] });
      void qc.invalidateQueries({ queryKey: ["report"] });
    },
  });
}

// --- Balances / reports / reminders ----------------------------------------
export function useBalances() {
  return useQuery({
    queryKey: ["balances"],
    queryFn: () => apiFetch<DriverBalance[]>("/balances"),
  });
}
export function useReport(from?: string, to?: string) {
  return useQuery({
    queryKey: ["report", from, to],
    queryFn: () => apiFetch<ReportSummary>("/reports/summary", { query: { from, to } }),
  });
}
export function useReminders() {
  return useQuery({
    queryKey: ["reminders"],
    queryFn: () => apiFetch<ReminderItem[]>("/reminders"),
  });
}

// --- Fines ------------------------------------------------------------------
export function useFines() {
  return useQuery({ queryKey: ["fines"], queryFn: () => apiFetch<Fine[]>("/fines") });
}
export function useSaveFine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; data: Record<string, unknown> }) =>
      input.id
        ? apiFetch(`/fines/${input.id}`, { method: "PATCH", body: input.data })
        : apiFetch("/fines", { method: "POST", body: input.data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fines"] });
      void qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}
export function useDeleteFine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/fines/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fines"] });
      void qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

// --- Shifts -----------------------------------------------------------------
export function useShifts() {
  return useQuery({ queryKey: ["shifts"], queryFn: () => apiFetch<Shift[]>("/shifts") });
}
export function useSaveShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; data: Record<string, unknown> }) =>
      input.id
        ? apiFetch(`/shifts/${input.id}`, { method: "PATCH", body: input.data })
        : apiFetch("/shifts", { method: "POST", body: input.data }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["shifts"] }),
  });
}
export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/shifts/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["shifts"] }),
  });
}

// --- Documents --------------------------------------------------------------
export function useAllDocuments() {
  return useQuery({
    queryKey: ["documents", "all"],
    queryFn: () => apiFetch<DocumentItem[]>("/documents"),
  });
}

/** Cover image per car: chosen coverDocumentId, else newest image fallback. */
export function useCarCoverPhotos() {
  const cars = useCars();
  const docs = useQuery({
    queryKey: ["documents", "CAR", "covers"],
    queryFn: () => apiFetch<DocumentItem[]>("/documents", { query: { relatedType: "CAR" } }),
  });

  const data = useMemo(() => {
    if (!cars.data) return undefined;
    const fallback = new Map<string, string>();
    const sorted = [...(docs.data ?? [])].sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );
    for (const doc of sorted) {
      if (!isImageDocument(doc)) continue;
      if (!fallback.has(doc.relatedId)) fallback.set(doc.relatedId, doc.id);
    }

    const map = new Map<string, string>();
    for (const car of cars.data) {
      const chosen = car.coverDocumentId ?? fallback.get(car.id);
      if (chosen) map.set(car.id, chosen);
    }
    return map;
  }, [cars.data, docs.data]);

  return { data, isLoading: cars.isLoading || docs.isLoading };
}

export function useDocuments(relatedType: string, relatedId: string | undefined) {
  return useQuery({
    queryKey: ["documents", relatedType, relatedId],
    queryFn: () =>
      apiFetch<DocumentItem[]>("/documents", { query: { relatedType, relatedId } }),
    enabled: Boolean(relatedId),
  });
}
export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      relatedType: string;
      relatedId: string;
      file: File;
      setAsCover?: boolean;
    }) => {
      const fd = new FormData();
      fd.append("relatedType", input.relatedType);
      fd.append("relatedId", input.relatedId);
      fd.append("file", input.file);
      if (input.setAsCover) fd.append("setAsCover", "true");
      return apiUpload<DocumentItem>("/documents", fd);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["documents"] });
      void qc.invalidateQueries({ queryKey: ["cars"] });
    },
  });
}
export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["documents"] });
      void qc.invalidateQueries({ queryKey: ["cars"] });
    },
  });
}

// --- Import -----------------------------------------------------------------
export interface ImportResult {
  created: number;
  total: number;
  errors: string[];
}
export function useImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: "cars" | "drivers" | "payments"; csv: string }) =>
      apiFetch<ImportResult>(`/import/${input.kind}`, { method: "POST", body: { csv: input.csv } }),
    onSuccess: () => {
      void qc.invalidateQueries();
    },
  });
}

// --- Admin ------------------------------------------------------------------
export function useOwners(enabled: boolean) {
  return useQuery({
    queryKey: ["owners"],
    queryFn: () => apiFetch<OwnerRow[]>("/admin/owners"),
    enabled,
  });
}
export function useActivateOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/owners/${id}/activate`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["owners"] }),
  });
}
export function useSuspendOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/owners/${id}/suspend`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["owners"] }),
  });
}
