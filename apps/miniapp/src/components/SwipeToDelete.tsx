import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "./crm";
import { confirmAction } from "../telegram";

const ACTION_WIDTH = 80;

export function SwipeToDelete(props: {
  children: ReactNode;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const offsetRef = useRef(0);
  const moved = useRef(false);

  function applyOffset(value: number) {
    const next = Math.max(-ACTION_WIDTH, Math.min(0, value));
    offsetRef.current = next;
    setOffset(next);
  }

  function snap(openRow: boolean) {
    setOpen(openRow);
    applyOffset(openRow ? -ACTION_WIDTH : 0);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest(".crm-swipe-action-btn")) return;
    startX.current = e.clientX;
    startOffset.current = offsetRef.current;
    moved.current = false;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 8) moved.current = true;
    applyOffset(startOffset.current + dx);
  }

  function finishDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer may already be released */
    }
    snap(offsetRef.current < -ACTION_WIDTH / 2);
  }

  function onContentClick() {
    if (moved.current) {
      moved.current = false;
      return;
    }
    if (open) {
      snap(false);
      return;
    }
    props.onPress?.();
  }

  async function handleDelete(e: React.PointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    e.preventDefault();
    const ok = await confirmAction(t("common.confirmDelete"), t("common.delete"), t("common.cancel"));
    if (ok) {
      props.onDelete();
      snap(false);
    }
  }

  function handleEdit(e: React.PointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    e.preventDefault();
    snap(false);
    props.onEdit?.();
  }

  const actionsVisible = open || offset < -12;
  const actionsOpacity = open ? 1 : Math.min(1, Math.abs(offset) / 40);
  const rootClass = ["crm-swipe-row", props.className].filter(Boolean).join(" ");

  return (
    <div className={rootClass}>
      <div
        className={`crm-swipe-row__actions${actionsVisible ? " crm-swipe-row__actions--visible" : ""}`}
        aria-hidden={!actionsVisible}
        style={{ opacity: actionsOpacity }}
      >
        <button
          type="button"
          className="crm-swipe-action-btn crm-swipe-action-btn--delete"
          onPointerUp={handleDelete}
          aria-label={t("common.delete")}
        >
          <Icon stroke="#fff" fill="none" width="22" height="22">
            <path
              d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M8 7l.8 11.2A1.5 1.5 0 0 0 10.3 19.5h3.4a1.5 1.5 0 0 0 1.5-1.3L16 7"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Icon>
        </button>
        {props.onEdit ? (
          <button
            type="button"
            className="crm-swipe-action-btn crm-swipe-action-btn--edit"
            onPointerUp={handleEdit}
            aria-label={t("common.edit")}
          >
            <Icon stroke="#fff" fill="none" width="22" height="22">
              <path
                d="M14.7 6.3a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0l-1.3 1.3 3 3 1.3-1.3zM5 13l7.1-7.1 3 3L8 16H5v-3z"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </Icon>
          </button>
        ) : null}
      </div>
      <div
        role={props.onPress ? "button" : undefined}
        tabIndex={props.onPress ? 0 : undefined}
        className={`crm-swipe-row__content${dragging ? " crm-swipe-row__content--dragging" : ""}${open ? " crm-swipe-row__content--open" : ""}${offset < -4 ? " crm-swipe-row__content--shifted" : ""}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClick={onContentClick}
        onKeyDown={(e) => {
          if (props.onPress && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onContentClick();
          }
        }}
      >
        {props.children}
      </div>
    </div>
  );
}
