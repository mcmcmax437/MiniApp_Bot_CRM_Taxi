import { Tabbar } from "@telegram-apps/telegram-ui";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function Layout({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: "/", icon: "🏠", label: t("nav.dashboard") },
    { id: "/cars", icon: "🚗", label: t("nav.cars") },
    { id: "/drivers", icon: "👤", label: t("nav.drivers") },
    { id: "/finance", icon: "💰", label: t("nav.finance") },
    { id: "/reports", icon: "📈", label: t("nav.reports") },
  ];
  if (isSuperAdmin) tabs.push({ id: "/admin", icon: "🛠️", label: t("nav.admin") });

  const current = "/" + (location.pathname.split("/")[1] ?? "");

  return (
    <div className="app-shell">
      <div className="page">
        <Outlet />
      </div>
      <Tabbar className="tabbar-fixed">
        {tabs.map((tab) => (
          <Tabbar.Item
            key={tab.id}
            text={tab.label}
            selected={current === tab.id}
            onClick={() => navigate(tab.id)}
          >
            <span style={{ fontSize: 22 }}>{tab.icon}</span>
          </Tabbar.Item>
        ))}
      </Tabbar>
    </div>
  );
}
