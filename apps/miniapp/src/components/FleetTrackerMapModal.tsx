import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useFleetTrackerLocations } from "../hooks";
import { IconActionButton } from "./crm";
import { Modal } from "./ui";
import type { FleetTrackerCar, FleetTrackerProgress } from "../types";
import { formatTrackerFixTime } from "../formatTrackerTime";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function vehicleLabel(car: { make: string | null; model: string | null }): string {
  return [car.make, car.model].filter(Boolean).join(" ");
}

function reasonLabel(error: string, t: (key: string) => string): string {
  switch (error) {
    case "tracker_not_configured":
      return t("cars.fleetMapNoTracker");
    case "tracker_login_failed":
      return t("cars.trackerMap.errorLogin");
    case "tracker_no_fix":
      return t("cars.trackerMap.errorNoFix");
    default:
      return t("cars.trackerMap.errorUnavailable");
  }
}
function markerHtml(car: FleetTrackerCar): string {
  const state = car.online ? " crm-fleet-pin--on" : "";
  return `<span class="crm-fleet-pin__label${state}">${escapeHtml(car.plate)}</span>`;
}

function FleetLoadProgress(props: { progress: FleetTrackerProgress | null }) {
  const { t } = useTranslation();
  const progress = props.progress;
  const total = progress?.total ?? 0;
  const done = progress?.done ?? 0;
  const left = Math.max(total - done, 0);
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const cars = progress?.cars ?? [];

  return (
    <div className="crm-fleet-map__progress" aria-live="polite">
      <p className="crm-form-hint">{t("cars.fleetMapLoading")}</p>
      <p className="crm-fleet-map__progress-count">
        {total > 0
          ? t("cars.fleetMapLoadingProgress", { done, total })
          : t("cars.fleetMapLoading")}
      </p>
      {total > 0 ? (
        <>
          <div
            className="crm-fleet-map__progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
          >
            <div className="crm-fleet-map__progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="crm-fleet-map__progress-meta">
            {progress?.plate
              ? t("cars.fleetMapLoadingCar", { plate: progress.plate })
              : t("cars.fleetMapLoadingStart")}
            {left > 0 ? (
              <span className="crm-fleet-map__progress-left">
                {" "}
                · {t("cars.fleetMapLoadingRemaining", { count: left })}
              </span>
            ) : null}
          </p>
        </>
      ) : null}
      {cars.length > 0 ? (
        <ul className="crm-fleet-map__progress-list">
          {cars.map((car) => {
            const state = car.status ?? "pending";
            return (
              <li
                key={car.id}
                className={`crm-fleet-map__progress-item crm-fleet-map__progress-item--${state}`}
              >
                <span className="crm-fleet-map__progress-mark" aria-hidden>
                  {state === "pending" ? "…" : state === "located" ? "✓" : "–"}
                </span>
                <span>
                  <strong>{car.plate}</strong>
                  {vehicleLabel(car) ? (
                    <span className="crm-fleet-map__vehicle"> {vehicleLabel(car)}</span>
                  ) : null}
                </span>
                <span className="crm-fleet-map__progress-status">
                  {state === "pending"
                    ? t("cars.fleetMapLoadingPending")
                    : state === "located"
                      ? t("cars.fleetMapLoadingOk")
                      : reasonLabel(car.error ?? "tracker_unavailable", t)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function FleetTrackerMapModal(props: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const query = useFleetTrackerLocations(props.open);
  const mapHost = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const located = query.data?.located ?? [];
  const missing = query.data?.missing ?? [];
  const progressTotal = query.progress?.total ?? 0;
  const progressDone = query.progress?.done ?? 0;
  const progressIncomplete = progressTotal > 0 && progressDone < progressTotal;
  const showProgress =
    query.isLoading || (query.isFetching && (!query.data || progressIncomplete));

  useEffect(() => {
    if (!props.open || located.length === 0 || !mapHost.current || showProgress) return;
    const host = mapHost.current;
    const map = L.map(host, { zoomControl: true });
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const bounds: [number, number][] = [];
    for (const car of located) {
      const icon = L.divIcon({
        className: "crm-fleet-pin",
        html: markerHtml(car),
        iconSize: [88, 28],
        iconAnchor: [44, 28],
      });
      const marker = L.marker([car.latitude, car.longitude], { icon }).addTo(map);
      const vehicle = [car.make, car.model].filter(Boolean).join(" ");
      const speed =
        car.speed != null ? `<br>${Math.round(car.speed)} ${t("cars.trackerMap.kmh")}` : "";
      const when = car.fixTime ? `<br>${escapeHtml(formatTrackerFixTime(car.fixTime))}` : "";
      marker.bindPopup(
        `<strong>${escapeHtml(car.plate)}</strong>${vehicle ? `<br>${escapeHtml(vehicle)}` : ""}${speed}${when}`,
      );
      bounds.push([car.latitude, car.longitude]);
    }

    if (bounds.length === 1) map.setView(bounds[0]!, 14);
    else map.fitBounds(bounds, { padding: [28, 28] });
    const timer = window.setTimeout(() => map.invalidateSize(), 320);

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, [props.open, located, t, showProgress]);

  const refreshLabel = query.isFetching ? t("cars.trackerMap.refreshing") : t("cars.trackerMap.refresh");

  return (
    <Modal
      open={props.open}
      title={t("cars.fleetMapTitle")}
      headerAction={
        <IconActionButton
          icon="refresh-01"
          label={refreshLabel}
          onClick={() => void query.refresh()}
          disabled={query.isFetching}
          spinning={query.isFetching}
          className="crm-modal-head__action"
        />
      }
      onClose={props.onClose}
    >
      {showProgress ? (
        <FleetLoadProgress progress={query.progress} />
      ) : query.isError ? (
        <p className="crm-form-hint">{t("cars.trackerMap.errorUnavailable")}</p>
      ) : (
        <div className="crm-fleet-map">
          {located.length > 0 ? <div className="crm-fleet-map__frame" ref={mapHost} /> : (
            <p className="crm-form-hint">{t("cars.fleetMapEmpty")}</p>
          )}
          <section className="crm-fleet-map__group">
            <h3 className="crm-fleet-map__heading">{t("cars.fleetMapOnMap", { count: located.length })}</h3>
            {located.length === 0 ? (
              <p className="crm-form-hint">{t("cars.fleetMapNone")}</p>
            ) : (
              <ul className="crm-fleet-map__list">
                {located.map((car) => (
                  <li key={car.id} className="crm-fleet-map__item crm-fleet-map__item--on">
                    <span className={`crm-tracker-dot${car.online ? " crm-tracker-dot--on" : ""}`} aria-hidden />
                    <span>
                      <strong>{car.plate}</strong>
                      {vehicleLabel(car) ? <span className="crm-fleet-map__vehicle"> {vehicleLabel(car)}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="crm-fleet-map__group">
            <h3 className="crm-fleet-map__heading">{t("cars.fleetMapOffMap", { count: missing.length })}</h3>
            {missing.length === 0 ? (
              <p className="crm-form-hint">{t("cars.fleetMapNone")}</p>
            ) : (
              <ul className="crm-fleet-map__list">
                {missing.map((car) => (
                  <li key={car.id} className="crm-fleet-map__item crm-fleet-map__item--off">
                    <span>
                      <strong>{car.plate}</strong>
                      {vehicleLabel(car) ? <span className="crm-fleet-map__vehicle"> {vehicleLabel(car)}</span> : null}
                    </span>
                    <span className="crm-fleet-map__reason">{reasonLabel(car.error, t)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
