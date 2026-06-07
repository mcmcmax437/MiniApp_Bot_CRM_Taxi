import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDocuments, useUploadDocument, useDeleteDocument } from "../hooks";
import { formatDate } from "./ui";
import { openDocumentFile } from "./documentUtils";
import { confirmAction } from "../telegram";

export function Documents(props: { relatedType: "CAR" | "DRIVER" | "AGREEMENT"; relatedId: string }) {
  const { t } = useTranslation();
  const docs = useDocuments(props.relatedType, props.relatedId);
  const upload = useUploadDocument();
  const del = useDeleteDocument();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="crm-agreement-section">
      <strong>{t("documents.title")}</strong>
      <div className="crm-doc-file-list" style={{ marginTop: 8 }}>
        {docs.isLoading ? <p>{t("common.loading")}</p> : null}
        {docs.data?.map((d) => (
          <div key={d.id} className="crm-doc-file">
            <button type="button" className="crm-doc-file__main" onClick={() => void openDocumentFile(d.id, d.fileName)}>
              <div className="crm-doc-file__icon">FILE</div>
              <div className="crm-doc-file__text">
                <div className="crm-doc-file__name">{d.fileName}</div>
                <div className="crm-doc-file__date">{formatDate(d.uploadedAt)}</div>
              </div>
            </button>
            <button
              type="button"
              className="crm-doc-file__delete"
              disabled={del.isPending && del.variables === d.id}
              onClick={async () => {
                const ok = await confirmAction(
                  t("common.confirmDelete"),
                  t("common.delete"),
                  t("common.cancel"),
                );
                if (ok) del.mutate(d.id);
              }}
              aria-label={t("common.delete")}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            upload.mutate(
              { relatedType: props.relatedType, relatedId: props.relatedId, file },
              { onSettled: () => { if (fileRef.current) fileRef.current.value = ""; } },
            );
          }
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
    </div>
  );
}
