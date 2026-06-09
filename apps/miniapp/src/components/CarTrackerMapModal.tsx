import { useTranslation } from "react-i18next";
import { useTrackerLocation } from "../hooks";
import { ApiError } from "../api";
import { Modal } from "./ui";

function osmEmbedUrl(lat: number, lng: number): string {
  const d = 0.006;
  const bbox = [lng - d, lat - d, lng + d, lat + d].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function trackerErrorKey(error: unknown): string {
  const code = error instanceof ApiError ? error.code : undefined;
  switch (code) {
    case "tracker_not_configured":
      return "cars.trackerMap.errorNotConfigured";
    case "tracker_login_failed":
      return "cars.trackerMap.errorLogin";
    case "tracker_no_fix":
      return "cars.trackerMap.errorNoFix";
    default:
      return "cars.trackerMap.errorUnavailable";
  }
}

export function CarTrackerMapModal(props: { open: boolean; carId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const query = useTrackerLocation(props.carId, props.open);
  const loc = query.data;

  return (
    <Modal open={props.open} title={t("cars.trackerMap.title")} onClose={props.onClose}>
      {query.isLoading ? (
        <p className="crm-form-hint">{t("cars.trackerMap.loading")}</p>
      ) : query.isError ? (
        <div className="crm-tracker-map__state">
          <p className="crm-form-hint">{t(trackerErrorKey(query.error))}</p>
          <button type="button" className="crm-link-btn" onClick={() => void query.refetch()}>
            {t("common.retry")}
          </button>
        </div>
      ) : loc ? (
        <div className="crm-tracker-map">
          <div className="crm-tracker-map__frame">
            <iframe
              title={t("cars.trackerMap.title")}
              src={osmEmbedUrl(loc.latitude, loc.longitude)}
              loading="lazy"
            />
          </div>
          <dl className="crm-car-detail-dl crm-tracker-map__meta">
            <div className="crm-car-detail-dl__row">
              <dt>{t("cars.trackerMap.status")}</dt>
              <dd>
                <span
                  className={`crm-tracker-dot${loc.online ? " crm-tracker-dot--on" : ""}`}
                  aria-hidden
                />
                {loc.online ? t("cars.trackerMap.online") : t("cars.trackerMap.offline")}
              </dd>
            </div>
            {loc.speed != null ? (
              <div className="crm-car-detail-dl__row">
                <dt>{t("cars.trackerMap.speed")}</dt>
                <dd>{Math.round(loc.speed)} {t("cars.trackerMap.kmh")}</dd>
              </div>
            ) : null}
            {loc.fixTime ? (
              <div className="crm-car-detail-dl__row">
                <dt>{t("cars.trackerMap.fixTime")}</dt>
                <dd>{loc.fixTime}</dd>
              </div>
            ) : null}
            <div className="crm-car-detail-dl__row">
              <dt>{t("cars.trackerMap.coords")}</dt>
              <dd>
                {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
              </dd>
            </div>
          </dl>
          <a
            className="crm-btn-primary crm-tracker-map__google"
            href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("cars.trackerMap.openGoogle")}
          </a>
          {query.isFetching ? (
            <p className="crm-form-hint crm-tracker-map__refreshing">
              {t("cars.trackerMap.refreshing")}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
