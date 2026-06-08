import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCars, useCarCoverPhotos, useDeleteCar } from "../hooks";
import { AppHeader, Icon } from "../components/crm";
import { CarCard, CarsEmptyState } from "../components/CarCard";
import { CarFormModal } from "../components/CarFormModal";
import { SwipeToDelete } from "../components/SwipeToDelete";

export function CarsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cars = useCars();
  const covers = useCarCoverPhotos();
  const del = useDeleteCar();
  const [createOpen, setCreateOpen] = useState(false);
  const [editCarId, setEditCarId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const editCar = (cars.data ?? []).find((car) => car.id === editCarId);

  const hasCars = (cars.data?.length ?? 0) > 0;

  const filteredCars = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (cars.data ?? []).filter((car) => {
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
  }, [cars.data, search, t]);

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
        <button type="button" className="crm-btn-primary" onClick={() => setCreateOpen(true)}>
          <Icon name="add-01" size={18} color="#fff" />
          <span>{t("cars.addCar")}</span>
        </button>
      </div>

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

      {!cars.isLoading && !hasCars && !search.trim() && (
        <CarsEmptyState onAdd={() => setCreateOpen(true)} />
      )}

      {!cars.isLoading && filteredCars.length === 0 && (hasCars || search.trim()) && (
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
              onPress={() => navigate(`/cars/${car.id}`)}
              onEdit={() => setEditCarId(car.id)}
              onDelete={() => del.mutate(car.id)}
            >
              <CarCard car={car} coverDocumentId={covers.data?.get(car.id)} />
            </SwipeToDelete>
          ))}
        </div>
      )}

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
