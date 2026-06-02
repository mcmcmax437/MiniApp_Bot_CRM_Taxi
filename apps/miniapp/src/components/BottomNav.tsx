import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icon } from "./crm";

type Tab = { id: string; label: string; icon: "home" | "car" | "person" | "documents" | "finance" | "reports" | "admin" };

function TabIcon({ name, active }: { name: Tab["icon"]; active: boolean }) {
  const color = active ? "var(--taxi-accent)" : "rgba(255, 255, 255, 0.72)";
  const stroke = active ? "var(--taxi-accent)" : "rgba(255, 255, 255, 0.72)";

  switch (name) {
    case "home":
      return active ? (
        <Icon fill={color}>
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z" />
        </Icon>
      ) : (
        <Icon stroke={stroke} fill="none">
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" strokeWidth="1.8" />
        </Icon>
      );
    case "car":
      return (
        <Icon stroke={active ? "none" : stroke} fill={active ? color : "none"}>
          {active ? (
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
          ) : (
            <>
              <path d="M5 11l1.5-4.5h11L19 11H5z" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M6.5 14.5a1.5 1.5 0 1 0 0 .01M17.5 14.5a1.5 1.5 0 1 0 0 .01" strokeWidth="1.8" />
              <path d="M3 12h18" strokeWidth="1.8" />
            </>
          )}
        </Icon>
      );
    case "person":
      return (
        <Icon stroke={stroke} fill="none">
          <circle cx="12" cy="8" r="3.5" strokeWidth="1.8" />
          <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" strokeWidth="1.8" strokeLinecap="round" />
        </Icon>
      );
    case "documents":
      return (
        <Icon stroke={stroke} fill="none">
          <path d="M8 4h8l2 4v12H6V4h2z" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M8 4v4h10M10 12h4M10 16h4" strokeWidth="1.8" strokeLinecap="round" />
        </Icon>
      );
    case "finance":
      return (
        <Icon stroke={stroke} fill="none">
          <path d="M12 4a8 8 0 1 0 0 16" strokeWidth="1.8" />
          <path d="M12 4v16M8 8h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6" strokeWidth="1.8" strokeLinecap="round" />
        </Icon>
      );
    case "reports":
      return (
        <Icon stroke={stroke} fill="none">
          <path d="M8 4h8v16H8z" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M10 9h4M10 12h4M10 15h2" strokeWidth="1.8" strokeLinecap="round" />
        </Icon>
      );
    case "admin":
      return (
        <Icon stroke={stroke} fill="none">
          <circle cx="12" cy="12" r="3" strokeWidth="1.8" />
          <path
            d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </Icon>
      );
  }
}

export function BottomNav({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs: Tab[] = [
    { id: "/", label: t("nav.dashboard"), icon: "home" },
    { id: "/cars", label: t("nav.cars"), icon: "car" },
    { id: "/drivers", label: t("nav.drivers"), icon: "person" },
    { id: "/documents", label: t("nav.documents"), icon: "documents" },
    { id: "/finance", label: t("nav.finance"), icon: "finance" },
    { id: "/reports", label: t("nav.reports"), icon: "reports" },
  ];
  if (isSuperAdmin) tabs.push({ id: "/admin", label: t("nav.admin"), icon: "admin" });

  const current = "/" + (location.pathname.split("/")[1] ?? "");

  return (
    <div className="crm-bottom-nav-wrap">
      <nav className="crm-bottom-nav" aria-label="Main">
        {tabs.map((tab) => {
          const active = current === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`crm-bottom-nav__item${active ? " crm-bottom-nav__item--active" : ""}`}
              onClick={() => navigate(tab.id)}
            >
              <TabIcon name={tab.icon} active={active} />
              <span className="crm-bottom-nav__label">{tab.label}</span>
              <span className={`crm-bottom-nav__dot${active ? " crm-bottom-nav__dot--visible" : ""}`} />
            </button>
          );
        })}
      </nav>
    </div>
  );
}
