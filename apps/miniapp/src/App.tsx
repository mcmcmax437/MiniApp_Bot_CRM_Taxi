import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "./i18n";
import { normalizeLocale } from "./locales";
import { useMe } from "./hooks";
import { setAppCurrency } from "./currency";
import type { Currency } from "@taxi/shared";
import { tg } from "./telegram";
import { Layout } from "./components/Layout";
import { AuthScreen } from "./components/AuthScreen";
import { ReadOnlyProvider } from "./readOnly";
import { Dashboard } from "./pages/Dashboard";
import { CarsPage } from "./pages/Cars";
import { CarDetailPage } from "./pages/CarDetail";
import { DriversPage } from "./pages/Drivers";
import { FinancePage } from "./pages/Finance";
import { ReportsPage } from "./pages/Reports";
import { DocumentsPage } from "./pages/Documents";
import { AdminPage } from "./pages/Admin";
import { RemindersPage } from "./pages/Reminders";

export function App() {
  const { t } = useTranslation();
  const me = useMe();

  useEffect(() => {
    if (me.data?.locale) {
      const locale = normalizeLocale(me.data.locale);
      if (locale !== i18n.language) {
        void i18n.changeLanguage(locale);
      }
    }
  }, [me.data?.locale]);

  useEffect(() => {
    if (me.data?.currency) {
      setAppCurrency(me.data.currency as Currency);
      localStorage.setItem("currency", me.data.currency);
    }
  }, [me.data?.currency]);

  if (me.isLoading) {
    return (
      <div className="center-screen">
        <span className="crm-spinner" style={{ width: 32, height: 32 }} />
        <p style={{ marginTop: 16, color: "var(--taxi-text-muted)" }}>{t("common.loading")}</p>
      </div>
    );
  }

  if (me.isError) {
    return (
      <AuthScreen
        variant="login"
        errorMessage={!tg?.initData ? t("pending.notInTelegram") : undefined}
      />
    );
  }

  const account = me.data!;

  if (account.needsOnboarding) {
    return <AuthScreen variant="chooseRole" telegramUserId={account.telegramUserId} />;
  }

  if (!account.isSuperAdmin && account.status !== "ACTIVE") {
    const suspended = account.status === "SUSPENDED";
    return (
      <AuthScreen
        variant={
          suspended ? "suspended" : account.isViewer ? "viewerPending" : "ownerPending"
        }
        telegramUserId={account.telegramUserId}
        fleetOwnerName={account.fleetOwnerName}
      />
    );
  }

  return (
    <ReadOnlyProvider readOnly={account.isViewer}>
      <Routes>
        <Route element={<Layout isSuperAdmin={account.isSuperAdmin} isViewer={account.isViewer} />}>
          <Route index element={<Dashboard />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="cars" element={<CarsPage />} />
          <Route path="cars/:id" element={<CarDetailPage />} />
          <Route path="drivers" element={<DriversPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="reports" element={<ReportsPage />} />
          {!account.isViewer ? (
            <Route path="admin" element={<AdminPage isSuperAdmin={account.isSuperAdmin} />} />
          ) : null}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ReadOnlyProvider>
  );
}
