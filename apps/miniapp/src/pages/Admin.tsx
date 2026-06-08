import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useOwners, useActivateOwner, useSuspendOwner } from "../hooks";
import { AppHeader, Icon } from "../components/crm";
import { OwnerCard, OwnersAddSection } from "../components/OwnerCard";
import { Modal } from "../components/ui";

export function AdminPage() {
  const { t } = useTranslation();
  const owners = useOwners(true);
  const activate = useActivateOwner();
  const suspend = useSuspendOwner();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="crm-page">
      <div className="crm-page-header-block">
        <AppHeader title={t("dashboard.appName")} subtitle={t("dashboard.appSubtitle")} />
      </div>

      <div className="crm-page-head">
        <div className="crm-page-head__titles">
          <h2 className="crm-page-head__title">{t("admin.title")}</h2>
          <p className="crm-page-head__subtitle">{t("admin.pageSubtitle")}</p>
        </div>
        <button type="button" className="crm-btn-primary" onClick={() => setAddOpen(true)}>
          <Icon name="add-01" size={18} color="#fff" />
          <span>{t("admin.addOwner")}</span>
        </button>
      </div>

      {owners.isLoading && (
        <div className="crm-empty-box">
          <span className="crm-spinner" />
          <p>{t("common.loading")}</p>
        </div>
      )}

      {!owners.isLoading && (owners.data?.length ?? 0) === 0 && (
        <div className="crm-empty-box">
          <p className="crm-empty-box__title">{t("common.empty")}</p>
        </div>
      )}

      <div className="crm-owner-list">
        {owners.data?.map((o) => (
          <OwnerCard
            key={o.id}
            owner={o}
            onActivate={() => activate.mutate(o.id)}
            onSuspend={() => suspend.mutate(o.id)}
            activating={activate.isPending && activate.variables === o.id}
            suspending={suspend.isPending && suspend.variables === o.id}
          />
        ))}
      </div>

      <OwnersAddSection onAdd={() => setAddOpen(true)} />

      <Modal open={addOpen} title={t("admin.addOwner")} onClose={() => setAddOpen(false)}>
        <p style={{ margin: 0, lineHeight: 1.5, color: "var(--taxi-text-muted)" }}>{t("admin.addOwnerHint")}</p>
        <button type="button" className="crm-btn-primary" style={{ width: "100%", marginTop: 16, justifyContent: "center" }} onClick={() => setAddOpen(false)}>
          {t("common.back")}
        </button>
      </Modal>
    </div>
  );
}
