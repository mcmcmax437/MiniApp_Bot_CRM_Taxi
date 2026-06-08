import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocuments, useUploadDocument, useDeleteDocument } from "../hooks";
import type { DocumentItem } from "../types";
import { openDocumentFile } from "./documentUtils";
import { DocumentFileRow } from "./DocumentFileRow";
import { DocumentMetaModal } from "./DocumentMetaModal";
import { confirmAction } from "../telegram";

export function CarDocumentsSection(props: { carId: string }) {
  const { t } = useTranslation();
  const docs = useDocuments("CAR", props.carId);
  const upload = useUploadDocument();
  const del = useDeleteDocument();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [editDoc, setEditDoc] = useState<DocumentItem | null>(null);

  const items = (docs.data ?? []).filter((d) => !d.isCarPhoto);

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
            isCarPhoto: false,
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

  async function handleDelete(doc: DocumentItem) {
    const ok = await confirmAction(t("common.confirmDelete"), t("common.delete"), t("common.cancel"));
    if (ok) del.mutate(doc.id);
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
              onOpen={() => void openDocumentFile(doc.id, doc.fileName)}
              onEdit={() => setEditDoc(doc)}
              onDelete={() => void handleDelete(doc)}
            />
          ))}
        </div>
      ) : (
        <p className="crm-form-hint">{t("tracking.noDocuments")}</p>
      )}

      <DocumentMetaModal doc={editDoc} open={editDoc != null} onClose={() => setEditDoc(null)} />
    </section>
  );
}
