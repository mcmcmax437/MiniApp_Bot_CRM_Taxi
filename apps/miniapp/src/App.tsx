import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "./i18n";
import { useMe } from "./hooks";
import { tg } from "./telegram";
import { Layout } from "./components/Layout";
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
    if (me.data?.locale && me.data.locale !== i18n.language) {
      void i18n.changeLanguage(me.data.locale);
    }
  }, [me.data?.locale]);

  if (me.isLoading) {
    return (
      <div className="center-screen">
        <span className="crm-spinner" style={{ width: 32, height: 32 }} />
        <p style={{ marginTop: 16, color: "var(--taxi-text-muted)" }}>{t("common.loading")}</p>
      </div>
    );
  }

  if (me.isError) {
    const status = me.error instanceof Error ? me.error.message : "";
    const noInitData = !tg?.initData;
    return (
      <div className="center-screen">
        <span style={{ fontSize: 56 }}>🚕</span>
        <h2 style={{ margin: "16px 0 8px", fontSize: 20 }}>{t("pending.title")}</h2>
        <p style={{ margin: 0, color: "var(--taxi-text-muted)", maxWidth: 320 }}>
          {noInitData ? t("pending.notInTelegram") : status}
        </p>
      </div>
    );
  }

  const owner = me.data!;

  if (!owner.isSuperAdmin && owner.status !== "ACTIVE") {
    const suspended = owner.status === "SUSPENDED";
    return (
      <div className="center-screen">
        <span style={{ fontSize: 56 }}>{suspended ? "⛔" : "⏳"}</span>
        <h2 style={{ margin: "16px 0 8px", fontSize: 20 }}>{t("pending.title")}</h2>
        <p style={{ margin: 0, color: "var(--taxi-text-muted)", maxWidth: 320 }}>
          {suspended ? t("pending.suspended") : t("pending.text")}
        </p>
        <p style={{ marginTop: 16, color: "var(--taxi-text-muted)" }}>
          {t("pending.yourId")}: <code>{owner.telegramUserId}</code>
        </p>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Layout isSuperAdmin={owner.isSuperAdmin} />}>
        <Route index element={<Dashboard />} />
        <Route path="reminders" element={<RemindersPage />} />
        <Route path="cars" element={<CarsPage />} />
        <Route path="cars/:id" element={<CarDetailPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="reports" element={<ReportsPage />} />
        {owner.isSuperAdmin && <Route path="admin" element={<AdminPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
