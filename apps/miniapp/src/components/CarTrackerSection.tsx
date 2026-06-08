import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Car } from "../types";

export function CarTrackerSection(props: { car: Car; onEdit: () => void }) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);

  const hasTracker =
    props.car.trackerLogin ||
    props.car.trackerPassword ||
    props.car.trackerUrl ||
    props.car.trackerNotes;

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard may be unavailable in some WebViews */
    }
  }

  return (
    <section className="glass-card crm-car-detail-section">
      <div className="crm-section-head">
        <h3 className="crm-car-detail-section__title">{t("cars.trackerTitle")}</h3>
        <button type="button" className="crm-link-btn" onClick={props.onEdit}>
          {hasTracker ? t("common.edit") : t("cars.addTracker")}
        </button>
      </div>
      {hasTracker ? (
        <dl className="crm-car-detail-dl">
          <TrackerRow label={t("cars.trackerLogin")} value={props.car.trackerLogin} onCopy={copyText} />
          <div className="crm-car-detail-dl__row">
            <dt>{t("cars.trackerPassword")}</dt>
            <dd className="crm-tracker-password">
              {props.car.trackerPassword ? (
                <>
                  <span>{showPassword ? props.car.trackerPassword : "••••••••"}</span>
                  <button
                    type="button"
                    className="crm-link-btn"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? t("common.hide") : t("common.show")}
                  </button>
                  <button
                    type="button"
                    className="crm-link-btn"
                    onClick={() => void copyText(props.car.trackerPassword!)}
                  >
                    {t("common.copy")}
                  </button>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          {props.car.trackerUrl ? (
            <div className="crm-car-detail-dl__row">
              <dt>{t("cars.trackerUrl")}</dt>
              <dd>
                <a
                  href={props.car.trackerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="crm-tracker-url"
                >
                  {props.car.trackerUrl}
                </a>
              </dd>
            </div>
          ) : null}
          {props.car.trackerNotes ? (
            <div className="crm-car-detail-dl__row">
              <dt>{t("cars.trackerNotes")}</dt>
              <dd>{props.car.trackerNotes}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="crm-form-hint">{t("cars.noTracker")}</p>
      )}
    </section>
  );
}

function TrackerRow(props: {
  label: string;
  value: string | null | undefined;
  onCopy: (text: string) => void;
}) {
  const { t } = useTranslation();
  const text = props.value?.trim();

  return (
    <div className="crm-car-detail-dl__row">
      <dt>{props.label}</dt>
      <dd className="crm-tracker-value">
        {text ? (
          <>
            <span>{text}</span>
            <button type="button" className="crm-link-btn" onClick={() => void props.onCopy(text)}>
              {t("common.copy")}
            </button>
          </>
        ) : (
          "—"
        )}
      </dd>
    </div>
  );
}
