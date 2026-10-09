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
  const failed = query.data?.failed ?? [];

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
      ) : located.length === 0 ? (
        <p className="crm-form-hint">{t("cars.fleetMapEmpty")}</p>
      ) : (
        <div className="crm-fleet-map">
          <div className="crm-fleet-map__frame" ref={mapHost} />
          {failed.length > 0 || (query.data?.unconfigured ?? 0) > 0 ? (
            <p className="crm-form-hint">
              {failed.length > 0
                ? t("cars.fleetMapFailed", {
                    count: failed.length,
                    plates: failed.map((car) => car.plate).join(", "),
                  })
                : null}
              {(query.data?.unconfigured ?? 0) > 0
                ? ` ${t("cars.fleetMapUnconfigured", { count: query.data?.unconfigured ?? 0 })}`
                : null}
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
