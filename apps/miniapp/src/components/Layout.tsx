import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MoneyRefreshBoundary } from "../currency";
import { BottomNav } from "./BottomNav";

export function Layout(props: { isSuperAdmin: boolean; isViewer?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={`app-shell taxi-crm-theme${props.isViewer ? " app-shell--viewer" : ""}`}>
      {props.isViewer ? (
        <div className="crm-viewer-banner" role="status">
          {t("team.viewerBanner")}
        </div>
      ) : null}
      <div className="page">
        <MoneyRefreshBoundary>
          <Outlet />
        </MoneyRefreshBoundary>
      </div>
      <BottomNav isSuperAdmin={props.isSuperAdmin} />
    </div>
  );
}
