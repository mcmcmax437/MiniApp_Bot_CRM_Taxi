import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

export function Layout({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  return (
    <div className="app-shell taxi-crm-theme">
      <div className="page">
        <Outlet />
      </div>
      <BottomNav isSuperAdmin={isSuperAdmin} />
    </div>
  );
}
