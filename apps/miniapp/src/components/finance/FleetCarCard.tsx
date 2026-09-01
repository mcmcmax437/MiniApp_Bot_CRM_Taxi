import { useTranslation } from "react-i18next";
import { agreementDriverDisplayName, agreementIsTemporaryDriver } from "@taxi/shared";
import type { Agreement, Car } from "../../types";
import { DocumentThumbnail } from "../DocumentThumbnail";
import { Icon } from "../crm";
import { formatDate, formatMoney } from "../ui";
import { resolveCarModelArt } from "./carModelArt";
import { contractEndTextColor } from "../../utils/expiryUrgency";

export function FleetCarCard(props: {
  car: Car;
  agreement?: Agreement;
  coverDocumentId?: string;
  readOnly: boolean;
  ending?: boolean;
  onOpenHistory: () => void;
  onAssign?: () => void;
  onReturn?: () => void;
}) {
  const { t } = useTranslation();
  const { car, agreement } = props;
  const modelLine = [car.make, car.model, car.year].filter(Boolean).join(" ");
  const art = resolveCarModelArt(car.make, car.model);
  const rented = Boolean(agreement);

  return (
    <article
      className={`crm-fleet-card${rented ? " crm-fleet-card--rented" : " crm-fleet-card--available"}`}
    >
      <button type="button" className="crm-fleet-card__body" onClick={props.onOpenHistory}>
        <div className="crm-fleet-card__media">
          {props.coverDocumentId ? (
            <DocumentThumbnail
              documentId={props.coverDocumentId}
              alt={modelLine || car.plate}
              className="crm-fleet-card__photo"
            />
          ) : art ? (
            <img src={art.src} alt={modelLine || car.plate} className="crm-fleet-card__art" />
          ) : (
            <span className="crm-fleet-card__art-fallback" aria-hidden>
              <Icon name="car-01" size={34} color="rgba(255,255,255,0.42)" />
            </span>
          )}
        </div>

        <div className="crm-fleet-card__main">
          <div className="crm-fleet-card__head">
            <div className="crm-fleet-card__identity">
              <span className="crm-fleet-card__plate">{car.plate}</span>
              {modelLine ? <span className="crm-fleet-card__model">{modelLine}</span> : null}
            </div>
            <span
              className={`crm-fleet-card__status${rented ? " crm-fleet-card__status--rented" : " crm-fleet-card__status--free"}`}
            >
              {rented ? t("fleet.onTheRoad") : t(`cars.${car.status}`)}
            </span>
          </div>

          {agreement ? (
            <>
              <p className="crm-fleet-card__meta">
                <span className="crm-fleet-card__driver">{agreementDriverDisplayName(agreement)}</span>
                {agreementIsTemporaryDriver(agreement) ? (
                  <span className="crm-fleet-card__temp-badge">{t("fleet.temporaryDriver")}</span>
                ) : null}
              </p>
              <p className="crm-fleet-card__meta">
                {t("fleet.since")} {formatDate(agreement.startDate)}
                {agreement.endDate ? (
                  <>
                    {" · "}
                    <span
                      className="crm-fleet-card__end"
                      style={{ color: contractEndTextColor(agreement.endDate) }}
                    >
                      {t("fleet.endsOn", { date: formatDate(agreement.endDate) })}
                    </span>
                  </>
                ) : null}
              </p>
              <div className="crm-fleet-card__rent">
                <span className="crm-fleet-card__rent-amount">
                  {formatMoney(agreement.rentAmount)}
                </span>
                <span className="crm-fleet-card__rent-period">/ {t(`drivers.${agreement.period}`)}</span>
              </div>
            </>
          ) : (
            <p className="crm-fleet-card__meta">{t("fleet.available")}</p>
          )}

          <span className="crm-fleet-card__history-link">
            {t("fleet.viewDriverHistory")}
            <Icon name="arrow-right-01" size={14} color="rgba(255,255,255,0.45)" />
          </span>
        </div>
      </button>

      {!props.readOnly ? (
        <div className="crm-fleet-card__actions">
          {agreement ? (
            <button
              type="button"
              className="crm-btn-outline crm-fleet-card__action"
              disabled={props.ending}
              onClick={props.onReturn}
            >
              {t("fleet.returnCar")}
            </button>
          ) : (
            <button
              type="button"
              className="crm-btn-primary crm-fleet-card__action"
              onClick={props.onAssign}
            >
              {t("fleet.assignCar")}
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}
