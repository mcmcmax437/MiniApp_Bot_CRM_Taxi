import { Outlet } from "react-router-dom";
import { MoneyRefreshBoundary } from "../currency";
import { BottomNav } from "./BottomNav";

export function Layout({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  return (
    <div className="app-shell taxi-crm-theme">
      <div className="page">
        <MoneyRefreshBoundary>
          <Outlet />
        </MoneyRefreshBoundary>
      </div>
      <BottomNav isSuperAdmin={isSuperAdmin} />
    </div>
  );
}
