import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CarStatus, TireSeason } from "@taxi/shared";
import { useCar, useReminders } from "../hooks";
import { AppHeader, Icon } from "../components/crm";
import { carNeedsAttention } from "../components/carAttention";
import { CarAttentionMark } from "../components/CarAttentionMark";
import { CarDetailHeroGallery } from "../components/CarDetailHeroGallery";
import { CarPhotosSection } from "../components/CarPhotosSection";
import { CarDocumentsSection } from "../components/CarDocumentsSection";
import { CarTrackingSections } from "../components/CarTrackingSections";
import { CarTrackerSection } from "../components/CarTrackerSection";
import { CarFormModal } from "../components/CarFormModal";
import { formatDate } from "../components/ui";
import { formatMoney } from "../currency";
import type { Car } from "../types";

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

  const car = carQuery.data;
  const subtitle = car ? [car.make, car.model, car.year].filter(Boolean).join(" ") : "";
  const needsAttention = useMemo(
    () => (car ? carNeedsAttention(car.id, reminders.data) : false),
    [car, reminders.data],
  );

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

      <CarDetailHeroGallery
        carId={car.id}
        coverDocumentId={car.coverDocumentId}
        alt={subtitle || car.plate}
      />

      <div className="crm-doc-detail-head">
        <span className="crm-doc-detail-head__badge">{t("cars.title")}</span>
        <h1 className="crm-doc-detail-head__title">
          <span className="crm-doc-detail-head__title-line">
            <span>{car.plate}</span>
            {needsAttention ? <CarAttentionMark /> : null}
          </span>
        </h1>
        {subtitle ? <p className="crm-doc-detail-head__subtitle">{subtitle}</p> : null}
        <div className={`crm-car-status ${statusClass[car.status]}`} style={{ marginTop: 10 }}>
          <Icon name="checkmark-circle-01" size={16} color="currentColor" />
          <span>{t(`cars.${car.status}`)}</span>
        </div>
      </div>

      <button type="button" className="crm-btn-primary crm-car-detail-edit" onClick={() => setEditOpen(true)}>
        {t("common.edit")}
      </button>

      <CarTrackingSections car={car} onUpdated={() => void carQuery.refetch()} />

      <section className="glass-card crm-car-detail-section">
        <h3 className="crm-car-detail-section__title">{t("cars.details")}</h3>
        <dl className="crm-car-detail-dl">
          <DetailRow label={t("cars.plate")} value={car.plate} />
          <DetailRow label={t("cars.vin")} value={car.vin} />
          <DetailRow label={t("cars.brand")} value={car.make} />
          <DetailRow label={t("cars.model")} value={car.model} />
          <DetailRow label={t("cars.year")} value={car.year != null ? String(car.year) : null} />
          <DetailRow label={t("cars.insurance")} value={formatDate(car.insuranceExpiry)} />
          <DetailRow label={t("cars.inspection")} value={formatDate(car.inspectionExpiry)} />
          {car.purchasePrice != null ? (
            <DetailRow label={t("cars.purchasePrice")} value={formatMoney(car.purchasePrice)} />
          ) : null}
          {car.purchaseDate ? (
            <DetailRow label={t("cars.purchaseDate")} value={formatDate(car.purchaseDate)} />
          ) : null}
          {car.notes ? <DetailRow label={t("cars.notes")} value={car.notes} /> : null}
        </dl>
      </section>

      <TiresSection car={car} onEdit={() => setEditOpen(true)} />

      <CarTrackerSection car={car} onEdit={() => setEditOpen(true)} />

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

      <CarDocumentsSection carId={car.id} />

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

function tireAxleValues(
  car: Car,
  axle: "front" | "rear",
): {
  brand: string | null | undefined;
  size: string | null | undefined;
  season: TireSeason | null | undefined;
  installedAt: string | null | undefined;
  notes: string | null | undefined;
} {
  if (axle === "front") {
    return {
      brand: car.tireFrontBrand ?? car.tireBrand,
      size: car.tireFrontSize ?? car.tireSize,
      season: car.tireFrontSeason ?? car.tireSeason,
      installedAt: car.tireFrontInstalledAt ?? car.tireInstalledAt,
      notes: car.tireFrontNotes ?? car.tireNotes,
    };
  }
  return {
    brand: car.tireRearBrand,
    size: car.tireRearSize,
    season: car.tireRearSeason,
    installedAt: car.tireRearInstalledAt,
    notes: car.tireRearNotes,
  };
}

function hasTireAxle(car: Car, axle: "front" | "rear"): boolean {
  const v = tireAxleValues(car, axle);
  return Boolean(v.brand || v.size || v.season || v.installedAt || v.notes);
}

function TiresSection(props: { car: Car; onEdit: () => void }) {
  const { t } = useTranslation();
  const front = tireAxleValues(props.car, "front");
  const rear = tireAxleValues(props.car, "rear");
  const hasAny = hasTireAxle(props.car, "front") || hasTireAxle(props.car, "rear");

  return (
    <section className="glass-card crm-car-detail-section">
      <div className="crm-section-head">
        <h3 className="crm-car-detail-section__title">{t("cars.tiresTitle")}</h3>
        <button type="button" className="crm-link-btn" onClick={props.onEdit}>
          {hasAny ? t("common.edit") : t("cars.addTires")}
        </button>
      </div>
      {!hasAny ? (
        <p className="crm-form-hint">{t("cars.noTiresYet")}</p>
      ) : (
        <>
          <TireAxleBlock title={t("cars.tireFrontTitle")} values={front} t={t} />
          <TireAxleBlock title={t("cars.tireRearTitle")} values={rear} t={t} />
        </>
      )}
    </section>
  );
}

function TireAxleBlock(props: {
  title: string;
  values: ReturnType<typeof tireAxleValues>;
  t: (key: string) => string;
}) {
  const hasData = Boolean(
    props.values.brand ||
      props.values.size ||
      props.values.season ||
      props.values.installedAt ||
      props.values.notes,
  );
  if (!hasData) {
    return (
      <div className="crm-tire-axle crm-tire-axle--empty">
        <h4 className="crm-tire-axle__title">{props.title}</h4>
        <p className="crm-form-hint">{props.t("cars.tireAxleEmpty")}</p>
      </div>
    );
  }
  return (
    <div className="crm-tire-axle">
      <h4 className="crm-tire-axle__title">{props.title}</h4>
      <dl className="crm-car-detail-dl">
        <DetailRow label={props.t("cars.tireBrand")} value={props.values.brand} />
        <DetailRow label={props.t("cars.tireSize")} value={props.values.size} />
        <DetailRow
          label={props.t("cars.tireSeasonField")}
          value={props.values.season ? props.t(`cars.tireSeason.${props.values.season}`) : null}
        />
        <DetailRow label={props.t("cars.tireInstalledAt")} value={formatDate(props.values.installedAt)} />
        {props.values.notes ? (
          <DetailRow label={props.t("cars.tireNotes")} value={props.values.notes} />
        ) : null}
      </dl>
    </div>
  );
}
