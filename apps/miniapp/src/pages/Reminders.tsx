import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useReminders } from "../hooks";
import { AppHeader, Icon } from "../components/crm";
import { ReminderList } from "../components/ReminderList";

export function RemindersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reminders = useReminders();

  return (
    <div className="crm-page">
      <div className="crm-page-header-block">
        <AppHeader title={t("dashboard.appName")} subtitle={t("dashboard.appSubtitle")} />
      </div>

      <div className="crm-page-head">
        <div className="crm-page-head__titles">
          <button type="button" className="crm-page-back" onClick={() => navigate("/")}>
            <Icon name="arrow-left-01" size={20} color="rgba(255,255,255,0.7)" />
            <span>{t("common.back")}</span>
          </button>
          <h2 className="crm-page-head__title">{t("reminders.pageTitle")}</h2>
          <p className="crm-page-head__subtitle">{t("reminders.pageSubtitle")}</p>
        </div>
      </div>

      {reminders.isLoading ? (
        <div className="crm-empty-box">
          <span className="crm-spinner" />
          <p>{t("common.loading")}</p>
        </div>
      ) : reminders.data && reminders.data.length === 0 ? (
        <div className="crm-empty-box">
          <p className="crm-empty-box__title">{t("dashboard.noReminders")}</p>
          <p className="crm-empty-box__subtitle">{t("dashboard.caughtUp")}</p>
        </div>
      ) : (
        <ReminderList items={reminders.data ?? []} />
      )}
    </div>
  );
}
