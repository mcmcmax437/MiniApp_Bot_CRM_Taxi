import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentItem } from "../types";
import { useUpdateDocument } from "../hooks";
import { Field, Modal, TextInput } from "./ui";

export function DocumentMetaModal(props: {
  doc: DocumentItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const update = useUpdateDocument();
  const [displayName, setDisplayName] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!props.doc) return;
    setDisplayName(props.doc.displayName ?? "");
    setNotes(props.doc.notes ?? "");
  }, [props.doc]);

  function save() {
    if (!props.doc) return;
    update.mutate(
      {
        id: props.doc.id,
        displayName: displayName.trim() || null,
        notes: notes.trim() || null,
      },
      { onSuccess: () => props.onClose() },
    );
  }

  return (
    <Modal
      open={props.open}
      title={t("documents.editFile")}
      backLabel={t("common.cancel")}
      onClose={props.onClose}
      footer={
        <button
          type="button"
          className="crm-btn-primary"
          disabled={update.isPending || !props.doc}
          onClick={save}
        >
          {t("common.save")}
        </button>
      }
    >
      {props.doc ? (
        <>
          <p className="crm-form-hint" style={{ marginBottom: 12 }}>
            {props.doc.fileName}
          </p>
          <Field label={t("documents.customName")}>
            <TextInput
              value={displayName}
              onChange={setDisplayName}
              placeholder={t("documents.customNamePlaceholder")}
            />
          </Field>
          <Field label={t("documents.fileNotes")}>
            <textarea
              className="crm-input"
              rows={3}
              value={notes}
              placeholder={t("documents.fileNotesPlaceholder")}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </>
      ) : null}
    </Modal>
  );
}
