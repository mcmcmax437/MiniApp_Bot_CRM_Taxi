import { useRef } from "react";
import { Cell, Button, Spinner } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";
import { useDocuments, useUploadDocument, useDeleteDocument } from "../hooks";
import { apiFileUrl } from "../api";
import { formatDate } from "./ui";

export function Documents(props: { relatedType: "CAR" | "DRIVER" | "AGREEMENT"; relatedId: string }) {
  const { t } = useTranslation();
  const docs = useDocuments(props.relatedType, props.relatedId);
  const upload = useUploadDocument();
  const del = useDeleteDocument();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--tgui--outline,#d1d1d6)", paddingTop: 12 }}>
      <strong>{t("documents.title")}</strong>
      <div style={{ marginTop: 8 }}>
        {docs.isLoading && <Spinner size="s" />}
        {docs.data?.map((d) => (
          <Cell
            key={d.id}
            subtitle={formatDate(d.uploadedAt)}
            after={
              <Button
                size="s"
                mode="plain"
                onClick={() => del.mutate(d.id)}
                loading={del.isPending && del.variables === d.id}
              >
                ✕
              </Button>
            }
            onClick={() => window.open(apiFileUrl(d.id), "_blank")}
          >
            📎 {d.fileName}
          </Cell>
        ))}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: "none" }}
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
      <Button
        mode="outline"
        stretched
        loading={upload.isPending}
        onClick={() => fileRef.current?.click()}
        style={{ marginTop: 8 }}
      >
        + {t("documents.upload")}
      </Button>
    </div>
  );
}
