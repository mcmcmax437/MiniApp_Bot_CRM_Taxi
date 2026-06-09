import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  useSaveCar,
} from "../hooks";
import type { DocumentItem } from "../types";
import { isCarGalleryPhoto } from "./documentUtils";
import { DocumentThumbnail } from "./DocumentThumbnail";
import { useDocumentImageViewer } from "./useDocumentImageViewer";
import { confirmAction } from "../telegram";

export function CarPhotosSection(props: {
  carId: string;
  coverDocumentId: string | null | undefined;
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const docs = useDocuments("CAR", props.carId);
  const upload = useUploadDocument();
  const del = useDeleteDocument();
  const save = useSaveCar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [setAsCoverOnUpload, setSetAsCoverOnUpload] = useState(false);
  const { openDocuments, viewer } = useDocumentImageViewer();

  const images = (docs.data ?? []).filter(isCarGalleryPhoto);

  function setCover(documentId: string) {
    save.mutate({ id: props.carId, data: { coverDocumentId: documentId } });
  }

  function onUpload(file: File) {
    const asCover = setAsCoverOnUpload || !props.coverDocumentId;
    upload.mutate(
      {
        relatedType: "CAR",
        relatedId: props.carId,
        file,
        isCarPhoto: true,
        setAsCover: asCover && file.type.startsWith("image/"),
      },
      {
        onSuccess: (doc) => {
          if (asCover && isCarGalleryPhoto(doc)) {
            setCover(doc.id);
          }
        },
        onSettled: () => {
          if (fileRef.current) fileRef.current.value = "";
        },
      },
    );
  }

  function openPhoto(index: number) {
    openDocuments(
      images.map((doc) => ({
        documentId: doc.id,
        fileName: doc.fileName,
        alt: doc.fileName,
      })),
      index,
    );
  }

  return (
    <div className="crm-agreement-section">
      {!props.embedded ? <strong>{t("cars.carPhotosTitle")}</strong> : null}
      {!props.embedded ? (
        <p className="crm-form-hint">{t("cars.carPhotosHint")}</p>
      ) : null}
      {images.length > 0 ? (
        <>
          <p className="crm-form-hint">{t("cars.pickCoverHint")}</p>
          <div className="crm-car-photo-grid">
            {images.map((doc, index) => (
              <CarImageTile
                key={doc.id}
                doc={doc}
                isCover={props.coverDocumentId === doc.id}
                onPreview={() => openPhoto(index)}
                onSetCover={() => setCover(doc.id)}
                onDelete={async () => {
                  const ok = await confirmAction(
                    t("common.confirmDelete"),
                    t("common.delete"),
                    t("common.cancel"),
                  );
                  if (ok) del.mutate(doc.id);
                }}
                deleting={del.isPending && del.variables === doc.id}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="crm-form-hint" style={{ marginTop: 8 }}>
          {t("cars.noPhoto")}
        </p>
      )}

      <label className="crm-car-cover-upload-opt">
        <input
          type="checkbox"
          checked={setAsCoverOnUpload}
          onChange={(e) => setSetAsCoverOnUpload(e.target.checked)}
        />
        <span>{t("cars.setAsCoverOnUpload")}</span>
      </label>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
        }}
      />
      <button
        type="button"
        className="crm-btn-outline"
        disabled={upload.isPending}
        onClick={() => fileRef.current?.click()}
        style={{ marginTop: 8 }}
      >
        + {t("documents.upload")}
      </button>

      {viewer}
    </div>
  );
}

function CarImageTile(props: {
  doc: DocumentItem;
  isCover: boolean;
  onPreview: () => void;
  onSetCover: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className={`crm-car-photo-tile${props.isCover ? " crm-car-photo-tile--cover" : ""}`}>
      <button type="button" className="crm-car-photo-tile__select" onClick={props.onPreview}>
        <DocumentThumbnail
          documentId={props.doc.id}
          fileName={props.doc.fileName}
          alt={props.doc.fileName}
          className="crm-car-photo-tile__img"
        />
        {props.isCover ? <span className="crm-car-photo-tile__badge">{t("cars.coverPhoto")}</span> : null}
      </button>
      <button
        type="button"
        className={`crm-car-photo-tile__cover-btn${props.isCover ? " crm-car-photo-tile__cover-btn--active" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          props.onSetCover();
        }}
      >
        {t("cars.coverPhoto")}
      </button>
      <button
        type="button"
        className="crm-car-photo-tile__remove"
        disabled={props.deleting}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          void props.onDelete();
        }}
        aria-label={t("common.delete")}
      >
        ✕
      </button>
    </div>
  );
}
