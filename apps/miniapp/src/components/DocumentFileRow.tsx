import type { DocumentItem } from "../types";
import { documentDisplayName, isImageDocument, isPdfDocument } from "./documentUtils";
import { formatDate } from "./ui";
import { SwipeToDelete } from "./SwipeToDelete";

export function DocumentFileRow(props: {
  doc: DocumentItem;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pdf = isPdfDocument(props.doc);
  const isImg = isImageDocument(props.doc);
  const title = documentDisplayName(props.doc);
  const notes = props.doc.notes?.trim();

  return (
    <SwipeToDelete
      className="crm-swipe-row--file"
      actionWidth={64}
      iconSize={18}
      onPress={props.onOpen}
      onEdit={props.onEdit}
      onDelete={props.onDelete}
    >
      <div className="crm-doc-file">
        <div className={`crm-doc-file__icon${pdf ? " crm-doc-file__icon--pdf" : isImg ? " crm-doc-file__icon--img" : ""}`}>
          {pdf ? "PDF" : isImg ? "IMG" : "FILE"}
        </div>
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
      </div>
    </SwipeToDelete>
  );
}
