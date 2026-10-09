import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useFleetTrackerLocations } from "../hooks";
import { IconActionButton } from "./crm";
import { Modal } from "./ui";
import type { FleetTrackerCar } from "../types";
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

export function FleetTrackerMapModal(props: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const query = useFleetTrackerLocations(props.open);
  const mapHost = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const located = query.data?.located ?? [];
  const missing = query.data?.missing ?? [];

  useEffect(() => {
    if (!props.open || located.length === 0 || !mapHost.current) return;
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
  }, [props.open, located, t]);

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
      {query.isLoading ? (
        <p className="crm-form-hint">{t("cars.fleetMapLoading")}</p>
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
