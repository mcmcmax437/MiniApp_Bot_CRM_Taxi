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
          <Icon width="20" height="20" stroke="currentColor" fill="none">
            <path d="M14 6l-6 6 6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Icon>
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
        <Icon width="20" height="20" stroke="currentColor" fill="none">
          <path d="M14 6l-6 6 6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Icon>
        {t("cars.backToList")}
      </button>

      <div className="crm-car-detail-hero">
        {coverId ? (
          <DocumentThumbnail documentId={coverId} alt={subtitle || car.plate} className="crm-car-detail-hero__img" />
        ) : (
          <div className="crm-car-detail-hero__placeholder">
            <Icon width="48" height="48" fill="rgba(255,255,255,0.35)">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM5 11l1.5-4.5h11L19 11H5z" />
            </Icon>
          </div>
        )}
      </div>

      <div className="crm-doc-detail-head">
        <span className="crm-doc-detail-head__badge">{t("cars.title")}</span>
        <h1 className="crm-doc-detail-head__title">{car.plate}</h1>
        {subtitle ? <p className="crm-doc-detail-head__subtitle">{subtitle}</p> : null}
        <div className={`crm-car-status ${statusClass[car.status]}`} style={{ marginTop: 10 }}>
          <Icon width="16" height="16" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 14-4-4 1.4-1.4 2.6 2.6 5.6-5.6L18 9l-7 7z" />
          </Icon>
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
