import { useTranslation } from "react-i18next";
import type { DocumentItem } from "../types";
import { documentDisplayName, isImageDocument, isPdfDocument } from "./documentUtils";
import { DocumentThumbnail } from "./DocumentThumbnail";
import { Icon } from "./crm";
import { formatDate } from "./ui";
import { SwipeToDelete } from "./SwipeToDelete";

export function DocumentFileRow(props: {
  doc: DocumentItem;
  onOpen: () => void;
  onDownload?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const readOnly = !props.onEdit && !props.onDelete;
  const pdf = isPdfDocument(props.doc);
  const isImg = isImageDocument(props.doc);
  const title = documentDisplayName(props.doc);
  const notes = props.doc.notes?.trim();

  return (
    <SwipeToDelete
      className="crm-swipe-row--file"
      actionWidth={72}
      iconSize={16}
      readOnly={readOnly}
      onPress={props.onOpen}
      onEdit={props.onEdit}
      onDelete={props.onDelete ?? (() => {})}
    >
      <div className="crm-doc-file">
        {isImg ? (
          <div className="crm-doc-file__thumb">
            <DocumentThumbnail
              documentId={props.doc.id}
              fileName={props.doc.fileName}
              alt={title}
            />
          </div>
        ) : (
          <div className={`crm-doc-file__icon${pdf ? " crm-doc-file__icon--pdf" : ""}`}>
            {pdf ? "PDF" : "FILE"}
          </div>
        )}
        <div className="crm-doc-file__text">
          <div className="crm-doc-file__name" title={title}>
            {title}
          </div>
          {notes ? (
            <div className="crm-doc-file__notes" title={notes}>
              {notes}
            </div>
          ) : null}
          <div className="crm-doc-file__date">{formatDate(props.doc.uploadedAt)}</div>
        </div>
        {props.onDownload ? (
          <button
            type="button"
            className="crm-doc-file__download"
            aria-label={t("documents.download")}
            onClick={(e) => {
              e.stopPropagation();
              props.onDownload?.();
            }}
          >
            <Icon name="download-01" size={18} color="rgba(255,255,255,0.75)" />
          </button>
        ) : null}
      </div>
    </SwipeToDelete>
  );
}
