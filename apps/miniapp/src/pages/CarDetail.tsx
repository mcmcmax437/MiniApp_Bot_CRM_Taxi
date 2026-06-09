import { useLayoutEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CarStatus } from "@taxi/shared";
import { useCar, useReminders } from "../hooks";
import { AppHeader, Icon } from "../components/crm";
import { carNeedsAttention } from "../components/carAttention";
import { CarAttentionMark } from "../components/CarAttentionMark";
import { CarDetailHeroGallery } from "../components/CarDetailHeroGallery";
import { CarOverviewPanel } from "../components/CarOverviewPanel";
import { CarPhotosSection } from "../components/CarPhotosSection";
import { CarDocumentsSection } from "../components/CarDocumentsSection";
import { CarTrackingSections } from "../components/CarTrackingSections";
import { CarTrackerSection } from "../components/CarTrackerSection";
import { CarFormModal } from "../components/CarFormModal";
import { CarTiresModal } from "../components/CarTiresModal";
import { CarTrackerModal } from "../components/CarTrackerModal";

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
  const reminders = useReminders();
  const [editOpen, setEditOpen] = useState(false);
  const [tiresOpen, setTiresOpen] = useState(false);
  const [trackerOpen, setTrackerOpen] = useState(false);

  const car = carQuery.data;

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [id]);

  useLayoutEffect(() => {
    if (!carQuery.isLoading && car) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [id, carQuery.isLoading, car?.id]);
  const subtitle = car ? [car.make, car.model, car.year].filter(Boolean).join(" ") : "";
  const needsAttention = useMemo(
    () => (car ? carNeedsAttention(car.id, reminders.data) : false),
    [car, reminders.data],
  );
  const assignedDriver = useMemo(() => {
    if (!car) return null;
    const agreement = car.agreements?.find((a) => a.driver?.id && a.driver?.fullName);
    if (!agreement?.driver) return null;
    return { id: agreement.driver.id, name: agreement.driver.fullName };
  }, [car]);

  function refresh() {
    void carQuery.refetch();
  }

  if (carQuery.isLoading) {
    return (
      <div className="crm-page crm-page--car-detail">
        <div className="crm-empty-box">
          <span className="crm-spinner" />
          <p>{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="crm-page crm-page--car-detail">
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

  return (
    <div className="crm-page crm-page--car-detail">
      <div className="crm-page-header-block">
        <AppHeader title={t("dashboard.appName")} subtitle={t("dashboard.appSubtitle")} />
      </div>

      <button type="button" className="crm-doc-back" onClick={() => navigate("/cars")}>
        <Icon name="arrow-left-01" size={20} color="currentColor" />
        {t("cars.backToList")}
      </button>

      <CarDetailHeroGallery
        carId={car.id}
        coverDocumentId={car.coverDocumentId}
        alt={subtitle || car.plate}
      />

      <div className="crm-doc-detail-head crm-car-detail-head">
        <span className="crm-doc-detail-head__badge">{t("cars.title")}</span>
        <div className="crm-car-detail-head__title-row">
          <h1 className="crm-doc-detail-head__title">
            <span className="crm-doc-detail-head__title-line">
              <span>{car.plate}</span>
              {needsAttention ? <CarAttentionMark /> : null}
            </span>
          </h1>
          {assignedDriver ? (
            <button
              type="button"
              className="crm-car-detail-head__driver-pill"
              title={assignedDriver.name}
              aria-label={t("cars.openDriverProfile")}
              onClick={() => navigate(`/drivers?view=${assignedDriver.id}`)}
            >
              <Icon name="user" size={14} color="var(--taxi-accent, #ffc107)" />
              <span className="crm-car-detail-head__driver-pill-name">{assignedDriver.name}</span>
              <Icon name="arrow-right-01" size={12} color="rgba(255,255,255,0.45)" />
            </button>
          ) : null}
        </div>
        {subtitle ? <p className="crm-doc-detail-head__subtitle">{subtitle}</p> : null}
        <div className={`crm-car-status ${statusClass[car.status]}`} style={{ marginTop: 8 }}>
          <Icon name="checkmark-circle-01" size={16} color="currentColor" />
          <span>{t(`cars.${car.status}`)}</span>
        </div>
      </div>

      <button type="button" className="crm-btn-primary crm-car-detail-edit" onClick={() => setEditOpen(true)}>
        {t("common.edit")}
      </button>

      <CarOverviewPanel car={car} onEditTires={() => setTiresOpen(true)} />

      <CarTrackingSections car={car} onUpdated={refresh} />

      <CarTrackerSection car={car} onEdit={() => setTrackerOpen(true)} />

      <CarDocumentsSection carId={car.id} />

      <section className="glass-card crm-car-detail-section">
        <CarPhotosSection carId={car.id} coverDocumentId={car.coverDocumentId} />
      </section>

      <CarFormModal
        open={editOpen}
        mode="edit"
        car={car}
        onClose={() => setEditOpen(false)}
        onSaved={refresh}
        onDeleted={() => navigate("/cars")}
      />

      <CarTiresModal
        open={tiresOpen}
        car={car}
        onClose={() => setTiresOpen(false)}
        onSaved={refresh}
      />

      <CarTrackerModal
        open={trackerOpen}
        car={car}
        onClose={() => setTrackerOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}
