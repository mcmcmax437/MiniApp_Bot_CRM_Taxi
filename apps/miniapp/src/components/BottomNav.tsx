import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icon, type IconName } from "./crm";

export function BottomNav({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs: { id: string; label: string; icon: IconName }[] = [
    { id: "/", label: t("nav.dashboard"), icon: "home-01" },
    { id: "/cars", label: t("nav.cars"), icon: "car-01" },
    { id: "/drivers", label: t("nav.drivers"), icon: "user" },
    { id: "/documents", label: t("nav.documents"), icon: "file-02" },
    { id: "/finance", label: t("nav.finance"), icon: "dollar-01" },
    { id: "/reports", label: t("nav.reports"), icon: "clipboard" },
  ];
  if (isSuperAdmin) tabs.push({ id: "/admin", label: t("nav.admin"), icon: "settings-01" });

  const current = "/" + (location.pathname.split("/")[1] ?? "");

  return (
    <div className="crm-bottom-nav-wrap">
      <nav className="crm-bottom-nav" aria-label="Main">
        {tabs.map((tab) => {
          const active = current === tab.id;
          const color = active ? "var(--taxi-accent)" : "rgba(255, 255, 255, 0.72)";
          return (
            <button
              key={tab.id}
              type="button"
              className={`crm-bottom-nav__item${active ? " crm-bottom-nav__item--active" : ""}`}
              onClick={() => navigate(tab.id)}
            >
              <Icon name={tab.icon} size={24} color={color} />
              <span className="crm-bottom-nav__label">{tab.label}</span>
              <span className={`crm-bottom-nav__dot${active ? " crm-bottom-nav__dot--visible" : ""}`} />
            </button>
          );
        })}
      </nav>
    </div>
  );
}
