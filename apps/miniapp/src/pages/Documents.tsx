import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DocumentRelatedType } from "@taxi/shared";
import {
  useAllDocuments,
  useAgreements,
  useCars,
  useDeleteDocument,
  useDrivers,
  useUploadDocument,
} from "../hooks";
import type { DocumentItem } from "../types";
import { AppHeader, Icon } from "../components/crm";
import { DocumentThumbnail } from "../components/DocumentThumbnail";
import { isImageDocument, isPdfDocument, openDocumentFile } from "../components/documentUtils";
import { formatDate } from "../components/ui";
import { confirmAction } from "../telegram";

type Category = "ALL" | DocumentRelatedType;

interface EntityRow {
  type: DocumentRelatedType;
  id: string;
  label: string;
  subtitle?: string;
  count: number;
  previewId?: string;
}

export function DocumentsPage() {
  const { t } = useTranslation();
  const docs = useAllDocuments();
  const cars = useCars();
  const drivers = useDrivers();
  const agreements = useAgreements();
  const upload = useUploadDocument();
  const del = useDeleteDocument();
  const fileRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<Category>("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ type: DocumentRelatedType; id: string } | null>(null);

  const docsByEntity = useMemo(() => {
    const map = new Map<string, DocumentItem[]>();
    for (const doc of docs.data ?? []) {
      const key = `${doc.relatedType}:${doc.relatedId}`;
      const list = map.get(key) ?? [];
      list.push(doc);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    }
    return map;
  }, [docs.data]);

  const entities = useMemo(() => {
    const rows: EntityRow[] = [];

    function docsFor(type: DocumentRelatedType, id: string): DocumentItem[] {
      return docsByEntity.get(`${type}:${id}`) ?? [];
    }

    function previewId(list: DocumentItem[]): string | undefined {
      return list.find(isImageDocument)?.id;
    }

    if (category === "ALL" || category === DocumentRelatedType.CAR) {
      for (const car of cars.data ?? []) {
        const list = docsFor(DocumentRelatedType.CAR, car.id);
        if (category === "ALL" && list.length === 0) continue;
        const subtitle = [car.make, car.model].filter(Boolean).join(" ");
        rows.push({
          type: DocumentRelatedType.CAR,
          id: car.id,
          label: car.plate,
          subtitle: subtitle || undefined,
          count: list.length,
          previewId: previewId(list),
        });
      }
    }

    if (category === "ALL" || category === DocumentRelatedType.DRIVER) {
      for (const driver of drivers.data ?? []) {
        const list = docsFor(DocumentRelatedType.DRIVER, driver.id);
        if (category === "ALL" && list.length === 0) continue;
        rows.push({
          type: DocumentRelatedType.DRIVER,
          id: driver.id,
          label: driver.fullName,
          subtitle: driver.phone ?? undefined,
          count: list.length,
          previewId: previewId(list),
        });
      }
    }

    if (category === "ALL" || category === DocumentRelatedType.AGREEMENT) {
      for (const agreement of agreements.data ?? []) {
        const list = docsFor(DocumentRelatedType.AGREEMENT, agreement.id);
        if (category === "ALL" && list.length === 0) continue;
        const subtitle = [agreement.driver?.fullName, agreement.car?.plate].filter(Boolean).join(" · ");
        rows.push({
          type: DocumentRelatedType.AGREEMENT,
          id: agreement.id,
          label: t(`documents.agreementLabel`, {
            driver: agreement.driver?.fullName ?? "—",
            car: agreement.car?.plate ?? "—",
          }),
          subtitle: subtitle || undefined,
          count: list.length,
          previewId: previewId(list),
        });
      }
    }

    if (category === "ALL") {
      rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    } else {
      rows.sort((a, b) => a.label.localeCompare(b.label));
    }

    return rows;
  }, [agreements.data, cars.data, category, docsByEntity, drivers.data, t]);

  const filteredEntities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entities;
    return entities.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        (e.subtitle?.toLowerCase().includes(q) ?? false) ||
        t(`documents.${e.type}`).toLowerCase().includes(q),
    );
  }, [entities, search, t]);

  const selectedEntity = useMemo(() => {
    if (!selected) return null;
    return entities.find((e) => e.type === selected.type && e.id === selected.id) ?? null;
  }, [entities, selected]);

  const selectedDocs = useMemo(() => {
    if (!selected) return [];
    return docsByEntity.get(`${selected.type}:${selected.id}`) ?? [];
  }, [docsByEntity, selected]);

  const imageDocs = selectedDocs.filter(isImageDocument);
  const fileDocs = selectedDocs.filter((d) => !isImageDocument(d));

  function handleUpload(file: File) {
    if (!selected) return;
    upload.mutate(
      { relatedType: selected.type, relatedId: selected.id, file },
      { onSettled: () => { if (fileRef.current) fileRef.current.value = ""; } },
    );
  }

  if (selected && selectedEntity) {
    return (
      <div className="crm-page">
        <div className="crm-page-header-block">
          <AppHeader title={t("dashboard.appName")} subtitle={t("dashboard.appSubtitle")} />
        </div>

        <button type="button" className="crm-doc-back" onClick={() => setSelected(null)}>
          <Icon stroke="rgba(255,255,255,0.7)" fill="none" width="20" height="20">
            <path d="M14 6l-6 6 6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Icon>
          <span>{t("common.back")}</span>
        </button>

        <div className="crm-doc-detail-head">
          <div className="crm-doc-detail-head__badge">{t(`documents.${selected.type}`)}</div>
          <h2 className="crm-doc-detail-head__title">{selectedEntity.label}</h2>
          {selectedEntity.subtitle ? (
            <p className="crm-doc-detail-head__subtitle">{selectedEntity.subtitle}</p>
          ) : null}
          <p className="crm-doc-detail-head__count">
            {t("documents.fileCount", { count: selectedDocs.length })}
          </p>
        </div>

        {docs.isLoading ? (
          <div className="crm-empty-box">
            <span className="crm-spinner" />
            <p>{t("common.loading")}</p>
          </div>
        ) : selectedDocs.length === 0 ? (
          <div className="crm-empty-box">
            <p className="crm-empty-box__title">{t("documents.noFilesYet")}</p>
            <p>{t("documents.uploadHint")}</p>
          </div>
        ) : (
          <>
            {imageDocs.length > 0 ? (
              <section className="crm-doc-section">
                <h3 className="crm-doc-section__title">{t("documents.photos")}</h3>
                <div className="crm-doc-grid">
                  {imageDocs.map((doc) => (
                    <div key={doc.id} className="crm-car-photo-tile">
                      <button
                        type="button"
                        className="crm-car-photo-tile__select"
                        onClick={() => void openDocumentFile(doc.id, doc.fileName)}
                      >
                        <DocumentThumbnail
                          documentId={doc.id}
                          fileName={doc.fileName}
                          alt={doc.fileName}
                          className="crm-car-photo-tile__img"
                        />
                      </button>
                      <button
                        type="button"
                        className="crm-car-photo-tile__remove"
                        disabled={del.isPending && del.variables === doc.id}
                        onClick={async () => {
                          const ok = await confirmAction(
                            t("common.confirmDelete"),
                            t("common.delete"),
                            t("common.cancel"),
                          );
                          if (ok) del.mutate(doc.id);
                        }}
                        aria-label={t("common.delete")}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {fileDocs.length > 0 ? (
              <section className="crm-doc-section">
                <h3 className="crm-doc-section__title">{t("documents.files")}</h3>
                <div className="crm-doc-file-list">
                  {fileDocs.map((doc) => (
                    <DocumentFileRow
                      key={doc.id}
                      doc={doc}
                      deleting={del.isPending && del.variables === doc.id}
                      onOpen={() => void openDocumentFile(doc.id, doc.fileName)}
                      onDelete={async () => {
                        const ok = await confirmAction(
                          t("common.confirmDelete"),
                          t("common.delete"),
                          t("common.cancel"),
                        );
                        if (ok) del.mutate(doc.id);
                      }}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />

        <button
          type="button"
          className="crm-btn-primary crm-doc-upload-btn"
          disabled={upload.isPending}
          onClick={() => fileRef.current?.click()}
        >
          <Icon width="18" height="18" stroke="#fff" fill="none">
            <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />
          </Icon>
          <span>{t("documents.upload")}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="crm-page">
      <div className="crm-page-header-block">
        <AppHeader title={t("dashboard.appName")} subtitle={t("dashboard.appSubtitle")} />
      </div>

      <div className="crm-page-head">
        <div className="crm-page-head__titles">
          <h2 className="crm-page-head__title">{t("documents.pageTitle")}</h2>
          <p className="crm-page-head__subtitle">{t("documents.pageSubtitle")}</p>
        </div>
      </div>

      <div className="crm-doc-tabs">
        {(["ALL", DocumentRelatedType.CAR, DocumentRelatedType.DRIVER, DocumentRelatedType.AGREEMENT] as const).map(
          (value) => (
            <button
              key={value}
              type="button"
              className={`crm-doc-tab${category === value ? " crm-doc-tab--active" : ""}`}
              onClick={() => setCategory(value)}
            >
              {value === "ALL" ? t("common.all") : t(`documents.${value}`)}
            </button>
          ),
        )}
      </div>

      <label className="crm-search-input crm-doc-search">
        <Icon stroke="rgba(255,255,255,0.45)" fill="none" width="20" height="20">
          <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
          <path d="M20 20l-3.5-3.5" strokeWidth="1.8" strokeLinecap="round" />
        </Icon>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("documents.searchPlaceholder")}
        />
      </label>

      {docs.isLoading || cars.isLoading || drivers.isLoading || agreements.isLoading ? (
        <div className="crm-empty-box">
          <span className="crm-spinner" />
          <p>{t("common.loading")}</p>
        </div>
      ) : filteredEntities.length === 0 ? (
        <div className="crm-empty-box">
          <p className="crm-empty-box__title">{t("documents.noEntities")}</p>
          <p>{t("documents.noEntitiesHint")}</p>
        </div>
      ) : (
        <div className="crm-doc-entity-list">
          {filteredEntities.map((entity) => (
            <button
              key={`${entity.type}:${entity.id}`}
              type="button"
              className="crm-doc-entity"
              onClick={() => setSelected({ type: entity.type, id: entity.id })}
            >
              <div className="crm-doc-entity__thumb">
                {entity.previewId ? (
                  <DocumentThumbnail documentId={entity.previewId} alt={entity.label} />
                ) : (
                  <div className="crm-doc-entity__placeholder">
                    <Icon stroke="rgba(255,255,255,0.35)" fill="none" width="28" height="28">
                      <rect x="5" y="3" width="14" height="18" rx="2" strokeWidth="1.6" />
                      <path d="M9 8h6M9 12h6" strokeWidth="1.6" strokeLinecap="round" />
                    </Icon>
                  </div>
                )}
              </div>

              <div className="crm-doc-entity__meta">
                <div className="crm-doc-entity__type">{t(`documents.${entity.type}`)}</div>
                <div className="crm-doc-entity__label">{entity.label}</div>
                {entity.subtitle ? <div className="crm-doc-entity__subtitle">{entity.subtitle}</div> : null}
              </div>

              <div className="crm-doc-entity__count">
                {t("documents.fileCount", { count: entity.count })}
              </div>

              <Icon className="crm-doc-entity__chevron" stroke="rgba(255,255,255,0.45)" fill="none" width="24" height="24">
                <path d="M10 8l4 4-4 4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </Icon>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentFileRow(props: {
  doc: DocumentItem;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { doc } = props;
  const pdf = isPdfDocument(doc);

  return (
    <div className="crm-doc-file">
      <button type="button" className="crm-doc-file__main" onClick={props.onOpen}>
        <div className={`crm-doc-file__icon${pdf ? " crm-doc-file__icon--pdf" : ""}`}>
          {pdf ? "PDF" : "FILE"}
        </div>
        <div className="crm-doc-file__text">
          <div className="crm-doc-file__name">{doc.fileName}</div>
          <div className="crm-doc-file__date">{formatDate(doc.uploadedAt)}</div>
        </div>
      </button>
      <button
        type="button"
        className="crm-doc-file__delete"
        disabled={props.deleting}
        onClick={props.onDelete}
        aria-label="Delete"
      >
        ✕
      </button>
    </div>
  );
}
