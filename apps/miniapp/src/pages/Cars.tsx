import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CarStatus } from "@taxi/shared";
import { useCars, useCarCoverPhotos, useDeleteCar, useReminders } from "../hooks";
import { useReadOnly } from "../readOnly";
import { carAttentionIds } from "../components/carAttention";
import { AppHeader, Icon } from "../components/crm";
import { CarCard, CarsEmptyState } from "../components/CarCard";
import { CarFormModal } from "../components/CarFormModal";
import { FleetTrackerMapModal } from "../components/FleetTrackerMapModal";
import { SwipeToDelete } from "../components/SwipeToDelete";

export function CarsPage() {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const navigate = useNavigate();
  const cars = useCars();
  const covers = useCarCoverPhotos();
  const del = useDeleteCar();
  const reminders = useReminders();
  const attentionCarIds = useMemo(() => carAttentionIds(reminders.data), [reminders.data]);
  const [createOpen, setCreateOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [editCarId, setEditCarId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [listView, setListView] = useState<"fleet" | "archive">("fleet");
  const editCar = (cars.data ?? []).find((car) => car.id === editCarId);

  const fleetCars = useMemo(
    () => (cars.data ?? []).filter((car) => car.status !== CarStatus.SOLD),
    [cars.data],
  );
  const archivedCars = useMemo(
    () => (cars.data ?? []).filter((car) => car.status === CarStatus.SOLD),
    [cars.data],
  );
  const hasCars = fleetCars.length > 0;
  const listSource = listView === "archive" ? archivedCars : fleetCars;

  const filteredCars = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listSource.filter((car) => {
      if (!q) return true;
      const hay = [
        car.plate,
        car.make,
        car.model,
        car.year != null ? String(car.year) : null,
        car.notes,
        car.status,
        t(`cars.${car.status}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [listSource, search, t]);

  return (
    <div className="crm-page">
      <div className="crm-page-header-block">
        <AppHeader title={t("dashboard.appName")} subtitle={t("dashboard.appSubtitle")} />
      </div>

      <div className="crm-page-head">
        <div className="crm-page-head__titles">
          <h2 className="crm-page-head__title">{t("cars.pageTitle")}</h2>
          <p className="crm-page-head__subtitle">{t("cars.pageSubtitle")}</p>
        </div>
        <div className="crm-page-head__actions">
          {hasCars ? (
            <button type="button" className="crm-fleet-map-btn" onClick={() => setMapOpen(true)}>
              <svg className="crm-fleet-map-btn__pin" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="currentColor"
                  d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
                />
              </svg>
              <span>{t("cars.fleetMap")}</span>
            </button>
          ) : null}
          {!readOnly ? (
            <button type="button" className="crm-btn-primary" onClick={() => setCreateOpen(true)}>
              <Icon name="add-01" size={18} color="#fff" />
              <span>{t("cars.addCar")}</span>
            </button>
          ) : null}
        </div>
      </div>

      {!cars.isLoading && (fleetCars.length > 0 || archivedCars.length > 0) && (
        <div className="crm-car-archive-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={listView === "fleet"}
            className={listView === "fleet" ? "is-active" : undefined}
            onClick={() => setListView("fleet")}
          >
            {t("cars.fleetList")}
            <span>{fleetCars.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={listView === "archive"}
            className={listView === "archive" ? "is-active" : undefined}
            onClick={() => setListView("archive")}
          >
            {t("cars.archive")}
            <span>{archivedCars.length}</span>
          </button>
        </div>
      )}

      {!cars.isLoading && (
        <div className="crm-search-row">
          <label className="crm-search-input">
            <Icon name="search-01" size={20} color="rgba(255,255,255,0.45)" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("cars.searchPlaceholder")}
            />
          </label>
        </div>
      )}

      {cars.isLoading && (
        <div className="crm-empty-box">
          <span className="crm-spinner" />
          <p>{t("common.loading")}</p>
        </div>
      )}

      {!cars.isLoading && listView === "fleet" && !hasCars && archivedCars.length === 0 && !search.trim() && !readOnly && (
        <CarsEmptyState onAdd={() => setCreateOpen(true)} />
      )}

      {!cars.isLoading && listView === "fleet" && !hasCars && archivedCars.length > 0 && !search.trim() && (
        <div className="crm-empty-box">
          <p className="crm-empty-box__title">{t("cars.fleetEmptyArchived")}</p>
        </div>
      )}

      {!cars.isLoading && filteredCars.length === 0 && listView === "archive" && !search.trim() && (
        <div className="crm-empty-box">
          <p className="crm-empty-box__title">{t("cars.archiveEmpty")}</p>
        </div>
      )}

      {!cars.isLoading && filteredCars.length === 0 && (listSource.length > 0 || search.trim()) && listView === "fleet" && (
        <div className="crm-empty-box">
          <p className="crm-empty-box__title">{t("cars.noResults")}</p>
        </div>
      )}

      {!cars.isLoading && filteredCars.length === 0 && search.trim() && listView === "archive" && (
        <div className="crm-empty-box">
          <p className="crm-empty-box__title">{t("cars.noResults")}</p>
        </div>
      )}

      {filteredCars.length > 0 && (
        <div className="crm-car-list">
          {filteredCars.map((car) => (
            <SwipeToDelete
              key={car.id}
              className="crm-swipe-row--car"
              readOnly={readOnly}
              onPress={() => navigate(`/cars/${car.id}`)}
              onEdit={readOnly ? undefined : () => setEditCarId(car.id)}
              onDelete={() => del.mutate(car.id)}
            >
              <CarCard
                car={car}
                coverDocumentId={covers.data?.get(car.id)}
                needsAttention={attentionCarIds.has(car.id)}
                reminders={reminders.data}
              />
            </SwipeToDelete>
          ))}
        </div>
      )}

      <FleetTrackerMapModal open={mapOpen} onClose={() => setMapOpen(false)} />

      <CarFormModal
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSaved={(car) => navigate(`/cars/${car.id}`)}
      />

      <CarFormModal
        open={editCarId !== null}
        mode="edit"
        car={editCar}
        onClose={() => setEditCarId(null)}
        onSaved={() => setEditCarId(null)}
        onDeleted={() => setEditCarId(null)}
      />
    </div>
  );
}
