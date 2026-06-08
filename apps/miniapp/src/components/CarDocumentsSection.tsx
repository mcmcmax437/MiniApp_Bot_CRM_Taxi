import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocuments, useUploadDocument, useDeleteDocument } from "../hooks";
import type { DocumentItem } from "../types";
import { isImageDocument, isPdfDocument, openDocumentFile } from "./documentUtils";
import { formatDate } from "./ui";
import { confirmAction } from "../telegram";

export function CarDocumentsSection(props: { carId: string }) {
  const { t } = useTranslation();
  const docs = useDocuments("CAR", props.carId);
  const upload = useUploadDocument();
  const del = useDeleteDocument();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const items = (docs.data ?? []).filter((d) => !isImageDocument(d));

  function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    void (async () => {
      for (const file of files) {
        try {
          await upload.mutateAsync({
            relatedType: "CAR",
            relatedId: props.carId,
            file,
          });
        } catch {
          /* continue with remaining files */
        }
      }
      if (fileRef.current) fileRef.current.value = "";
    })();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  }

  return (
    <section className="glass-card crm-car-detail-section">
      <h3 className="crm-car-detail-section__title">{t("tracking.documentsTitle")}</h3>
      <div
        className={`crm-dropzone${dragOver ? " crm-dropzone--active" : ""}`}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
      >
        <p className="crm-dropzone__title">{t("tracking.dropFiles")}</p>
        <p className="crm-dropzone__hint">{t("tracking.dropFilesHint")}</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) uploadFiles(e.target.files);
        }}
      />

      {docs.isLoading ? (
        <p className="crm-form-hint">{t("common.loading")}</p>
      ) : items.length > 0 ? (
        <div className="crm-doc-file-list" style={{ marginTop: 12 }}>
          {items.map((doc) => (
            <DocumentFileRow
              key={doc.id}
              doc={doc}
              deleting={del.isPending && del.variables === doc.id}
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
      ) : (
        <p className="crm-form-hint">{t("tracking.noDocuments")}</p>
      )}
    </section>
  );
}

function DocumentFileRow(props: {
  doc: DocumentItem;
  deleting: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const isPdf = isPdfDocument(props.doc);

  return (
    <div className="crm-doc-file">
      <button
        type="button"
        className="crm-doc-file__main"
        onClick={() => void openDocumentFile(props.doc.id, props.doc.fileName)}
      >
        <div className="crm-doc-file__icon">{isPdf ? "PDF" : "FILE"}</div>
        <div className="crm-doc-file__text">
          <div className="crm-doc-file__name">{props.doc.fileName}</div>
          <div className="crm-doc-file__date">{formatDate(props.doc.uploadedAt)}</div>
        </div>
      </button>
      <button
        type="button"
        className="crm-doc-file__delete"
        disabled={props.deleting}
        onClick={() => void props.onDelete()}
        aria-label={t("common.delete")}
      >
        ✕
      </button>
    </div>
  );
}
