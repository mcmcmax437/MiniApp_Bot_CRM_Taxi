import { useTranslation } from "react-i18next";
import { Modal } from "../ui";
import { formatDate } from "../../dates";
import { Icon } from "../crm";

export interface NoteViewerItem {
  title: string;
  subtitle?: string;
  note: string;
  /** ISO date string or any date-ish value that formatDate can handle. */
  date?: string;
  /** Formatted amount, e.g. "1 200,00 zł". Shown on the right. */
  amount?: string;
}

/**
 * Read-only viewer for long notes. Lets the user see the full text without
 * opening the editor — used in expense/payment lists where the title is
 * truncated to keep rows scannable.
 */
export function NoteViewerModal(props: {
  open: boolean;
  item: NoteViewerItem | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!props.item) return null;

  return (
    <Modal open={props.open} title={t("finance.viewNote")} onClose={props.onClose}>
      <div className="crm-note-viewer">
        <div className="crm-note-viewer__head">
          <div>
            <div className="crm-note-viewer__title">{props.item.title}</div>
            {props.item.subtitle ? (
              <div className="crm-note-viewer__subtitle">{props.item.subtitle}</div>
            ) : null}
          </div>
          {props.item.amount ? (
            <div className="crm-note-viewer__amount">{props.item.amount}</div>
          ) : null}
        </div>

        {props.item.date ? (
          <div className="crm-note-viewer__date">
            <Icon name="calendar-01" size={16} color="rgba(255,255,255,0.55)" />
            <span>{formatDate(props.item.date)}</span>
          </div>
        ) : null}

        <pre className="crm-note-viewer__note">{props.item.note}</pre>
      </div>
    </Modal>
  );
}

/** Helper used by the list rows: collapse a long note to a preview. */
export function previewNote(note: string, max = 140): string {
  const trimmed = note.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}
