import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  useSaveCar,
} from "../hooks";
import type { DocumentItem } from "../types";
import { isImageDocument, isPdfDocument } from "./documentUtils";
import { DocumentThumbnail } from "./DocumentThumbnail";
import { formatDate } from "./ui";
import { openDocumentFile } from "./documentUtils";

export function CarPhotosSection(props: { carId: string; coverDocumentId: string | null | undefined }) {
  const { t } = useTranslation();
  const docs = useDocuments("CAR", props.carId);
  const upload = useUploadDocument();
  const del = useDeleteDocument();
  const save = useSaveCar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [setAsCoverOnUpload, setSetAsCoverOnUpload] = useState(false);

  const images = (docs.data ?? []).filter(isImageDocument);
  const files = (docs.data ?? []).filter((d) => !isImageDocument(d));

  function setCover(documentId: string) {
    save.mutate({ id: props.carId, data: { coverDocumentId: documentId } });
  }

  function onUpload(file: File) {
    const asCover = setAsCoverOnUpload || !props.coverDocumentId;
    upload.mutate(
      { relatedType: "CAR", relatedId: props.carId, file, setAsCover: asCover && file.type.startsWith("image/") },
      {
        onSuccess: (doc) => {
          if (asCover && isImageDocument(doc)) {
            setCover(doc.id);
          }
        },
        onSettled: () => {
          if (fileRef.current) fileRef.current.value = "";
        },
      },
    );
  }

  return (
    <div className="crm-agreement-section">
      <strong>{t("cars.photos")}</strong>
      {images.length > 0 ? (
        <>
          <p className="crm-form-hint">{t("cars.pickCoverHint")}</p>
          <div className="crm-car-photo-grid">
            {images.map((doc) => (
              <CarImageTile
                key={doc.id}
                doc={doc}
                isCover={props.coverDocumentId === doc.id}
                onSetCover={() => setCover(doc.id)}
                onDelete={() => {
                  if (confirm(t("common.confirmDelete"))) del.mutate(doc.id);
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
        accept="image/*,application/pdf"
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

      {files.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <strong>{t("documents.files")}</strong>
          <div className="crm-doc-file-list" style={{ marginTop: 8 }}>
            {files.map((d) => (
              <FileRow key={d.id} doc={d} onDelete={() => del.mutate(d.id)} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CarImageTile(props: {
  doc: DocumentItem;
  isCover: boolean;
  onSetCover: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className={`crm-car-photo-tile${props.isCover ? " crm-car-photo-tile--cover" : ""}`}>
      <button type="button" className="crm-car-photo-tile__select" onClick={props.onSetCover}>
        <DocumentThumbnail documentId={props.doc.id} alt={props.doc.fileName} className="crm-car-photo-tile__img" />
        {props.isCover ? <span className="crm-car-photo-tile__badge">{t("cars.coverPhoto")}</span> : null}
      </button>
      <button
        type="button"
        className="crm-car-photo-tile__remove"
        disabled={props.deleting}
        onClick={props.onDelete}
        aria-label={t("common.delete")}
      >
        ✕
      </button>
    </div>
  );
}

function FileRow(props: { doc: DocumentItem; onDelete: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="crm-doc-file">
      <button
        type="button"
        className="crm-doc-file__main"
        onClick={() => void openDocumentFile(props.doc.id, props.doc.fileName)}
      >
        <div className="crm-doc-file__icon">{isPdfDocument(props.doc) ? "PDF" : "FILE"}</div>
        <div className="crm-doc-file__text">
          <div className="crm-doc-file__name">{props.doc.fileName}</div>
          <div className="crm-doc-file__date">{formatDate(props.doc.uploadedAt)}</div>
        </div>
      </button>
      <button
        type="button"
        className="crm-doc-file__delete"
        onClick={() => {
          if (confirm(t("common.confirmDelete"))) props.onDelete();
        }}
        aria-label={t("common.delete")}
      >
        ✕
      </button>
    </div>
  );
}
