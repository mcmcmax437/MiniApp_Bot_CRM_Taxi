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
import { DocumentFileRow } from "../components/DocumentFileRow";
import { DocumentMetaModal } from "../components/DocumentMetaModal";
import { isCarGalleryPhoto, isImageDocument } from "../components/documentUtils";
import { useDocumentImageViewer } from "../components/useDocumentImageViewer";
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
  const [editDoc, setEditDoc] = useState<DocumentItem | null>(null);
  const { openDocument, openDocuments, viewer } = useDocumentImageViewer();

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

    function previewId(type: DocumentRelatedType, list: DocumentItem[]): string | undefined {
      if (type === DocumentRelatedType.CAR) {
        return list.find(isCarGalleryPhoto)?.id;
      }
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
          previewId: previewId(DocumentRelatedType.CAR, list),
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
          previewId: previewId(DocumentRelatedType.DRIVER, list),
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
          previewId: previewId(DocumentRelatedType.AGREEMENT, list),
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

  const { imageDocs, fileDocs } = useMemo(() => {
    if (!selected) return { imageDocs: [] as DocumentItem[], fileDocs: [] as DocumentItem[] };
    if (selected.type === DocumentRelatedType.CAR) {
      return {
        imageDocs: selectedDocs.filter(isCarGalleryPhoto),
        fileDocs: selectedDocs.filter((d) => !d.isCarPhoto),
      };
    }
    return {
      imageDocs: selectedDocs.filter(isImageDocument),
      fileDocs: selectedDocs.filter((d) => !isImageDocument(d)),
    };
  }, [selected, selectedDocs]);

  function handleUpload(file: File) {
    if (!selected) return;
    upload.mutate(
      {
        relatedType: selected.type,
        relatedId: selected.id,
        file,
        isCarPhoto: false,
      },
      { onSettled: () => { if (fileRef.current) fileRef.current.value = ""; } },
    );
  }

  async function handleDelete(doc: DocumentItem) {
    const ok = await confirmAction(t("common.confirmDelete"), t("common.delete"), t("common.cancel"));
    if (ok) del.mutate(doc.id);
  }

  if (selected && selectedEntity) {
    return (
      <div className="crm-page">
        <div className="crm-page-header-block">
          <AppHeader title={t("dashboard.appName")} subtitle={t("dashboard.appSubtitle")} />
        </div>

        <button type="button" className="crm-doc-back" onClick={() => setSelected(null)}>
          <Icon name="arrow-left-01" size={20} color="rgba(255,255,255,0.7)" />
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
                  {imageDocs.map((doc, index) => (
                    <div key={doc.id} className="crm-car-photo-tile">
                      <button
                        type="button"
                        className="crm-car-photo-tile__select"
                        onClick={() =>
                          openDocuments(
                            imageDocs.map((d) => ({
                              documentId: d.id,
                              fileName: d.fileName,
                              alt: d.fileName,
                            })),
                            index,
                          )
                        }
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
                      onOpen={() => openDocument(doc)}
                      onEdit={() => setEditDoc(doc)}
                      onDelete={() => void handleDelete(doc)}
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
          <Icon name="add-01" size={18} color="#fff" />
          <span>{t("documents.upload")}</span>
        </button>

        <DocumentMetaModal doc={editDoc} open={editDoc != null} onClose={() => setEditDoc(null)} />
        {viewer}
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
        <Icon name="search-01" size={20} color="rgba(255,255,255,0.45)" />
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
                    <Icon name="file-02" size={28} color="rgba(255,255,255,0.35)" />
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

              <Icon className="crm-doc-entity__chevron" name="arrow-right-01" size={24} color="rgba(255,255,255,0.45)" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

