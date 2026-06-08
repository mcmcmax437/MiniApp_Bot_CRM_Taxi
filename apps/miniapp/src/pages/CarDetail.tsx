import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CarStatus } from "@taxi/shared";
import { useCar, useCarCoverPhotos } from "../hooks";
import { AppHeader, Icon } from "../components/crm";
import { DocumentThumbnail } from "../components/DocumentThumbnail";
import { CarPhotosSection } from "../components/CarPhotosSection";
import { CarTrackingSections } from "../components/CarTrackingSections";
import { CarFormModal } from "../components/CarFormModal";
import { formatDate } from "../components/ui";

const statusClass: Record<CarStatus, string> = {
  [CarStatus.AVAILABLE]: "crm-car-status--available",
  [CarStatus.RENTED]: "crm-car-status--rented",
  [CarStatus.MAINTENANCE]: "crm-car-status--maintenance",
  [CarStatus.INACTIVE]: "crm-car-status--inactive",
};

export function CarDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const carQuery = useCar(id);
  const covers = useCarCoverPhotos();
  const [editOpen, setEditOpen] = useState(false);

  const car = carQuery.data;
  const coverId = car?.coverDocumentId ?? (id ? covers.data?.get(id) : undefined);
  const subtitle = car ? [car.make, car.model, car.year].filter(Boolean).join(" ") : "";

  if (carQuery.isLoading) {
    return (
      <div className="crm-page">
        <div className="crm-empty-box">
          <span className="crm-spinner" />
          <p>{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="crm-page">
        <button type="button" className="crm-doc-back" onClick={() => navigate("/cars")}>
          <Icon name="arrow-left-01" size={20} color="currentColor" />
          {t("cars.backToList")}
        </button>
        <div className="crm-empty-box">
          <p className="crm-empty-box__title">{t("common.empty")}</p>
        </div>
      </div>
    );
  }

  const activeDrivers =
    car.agreements?.map((a) => a.driver?.fullName).filter(Boolean) ?? [];

  return (
    <div className="crm-page">
      <div className="crm-page-header-block">
        <AppHeader title={t("dashboard.appName")} subtitle={t("dashboard.appSubtitle")} />
      </div>

      <button type="button" className="crm-doc-back" onClick={() => navigate("/cars")}>
        <Icon name="arrow-left-01" size={20} color="currentColor" />
        {t("cars.backToList")}
      </button>

      <div className="crm-car-detail-hero">
        {coverId ? (
          <DocumentThumbnail documentId={coverId} alt={subtitle || car.plate} className="crm-car-detail-hero__img" />
        ) : (
          <div className="crm-car-detail-hero__placeholder">
            <Icon name="car-01" size={48} color="rgba(255,255,255,0.35)" />
          </div>
        )}
      </div>

      <div className="crm-doc-detail-head">
        <span className="crm-doc-detail-head__badge">{t("cars.title")}</span>
        <h1 className="crm-doc-detail-head__title">{car.plate}</h1>
        {subtitle ? <p className="crm-doc-detail-head__subtitle">{subtitle}</p> : null}
        <div className={`crm-car-status ${statusClass[car.status]}`} style={{ marginTop: 10 }}>
          <Icon name="checkmark-circle-01" size={16} color="currentColor" />
          <span>{t(`cars.${car.status}`)}</span>
        </div>
      </div>

      <button type="button" className="crm-btn-primary crm-car-detail-edit" onClick={() => setEditOpen(true)}>
        {t("common.edit")}
      </button>

      <section className="glass-card crm-car-detail-section">
        <h3 className="crm-car-detail-section__title">{t("cars.details")}</h3>
        <dl className="crm-car-detail-dl">
          <DetailRow label={t("cars.plate")} value={car.plate} />
          <DetailRow label={t("cars.brand")} value={car.make} />
          <DetailRow label={t("cars.model")} value={car.model} />
          <DetailRow label={t("cars.year")} value={car.year != null ? String(car.year) : null} />
          <DetailRow label={t("cars.insurance")} value={formatDate(car.insuranceExpiry)} />
          <DetailRow label={t("cars.inspection")} value={formatDate(car.inspectionExpiry)} />
          {car.notes ? <DetailRow label={t("cars.notes")} value={car.notes} /> : null}
        </dl>
      </section>

      <section className="glass-card crm-car-detail-section">
        <h3 className="crm-car-detail-section__title">{t("cars.activeDrivers")}</h3>
        {activeDrivers.length > 0 ? (
          <ul className="crm-car-detail-drivers">
            {activeDrivers.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        ) : (
          <p className="crm-form-hint">{t("cars.noActiveDriver")}</p>
        )}
      </section>

      <CarTrackingSections car={car} onUpdated={() => void carQuery.refetch()} />

      <section className="glass-card crm-car-detail-section">
        <CarPhotosSection carId={car.id} coverDocumentId={car.coverDocumentId} />
      </section>

      <CarFormModal
        open={editOpen}
        mode="edit"
        car={car}
        onClose={() => setEditOpen(false)}
        onSaved={() => void carQuery.refetch()}
        onDeleted={() => navigate("/cars")}
      />
    </div>
  );
}

function DetailRow(props: { label: string; value: string | null | undefined }) {
  return (
    <div className="crm-car-detail-dl__row">
      <dt>{props.label}</dt>
      <dd>{props.value?.trim() ? props.value : "—"}</dd>
    </div>
  );
}
