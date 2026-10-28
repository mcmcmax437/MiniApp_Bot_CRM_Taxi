import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Icon } from "./crm";
import { downloadDocumentFile, fetchDocumentBlob, normalizeRotation } from "./documentUtils";

export type DocumentViewerItem = {
  documentId: string;
  fileName: string;
  alt?: string;
  rotation?: number;
};

export type ImageViewerState =
  | { kind: "document"; items: DocumentViewerItem[]; index: number }
  | { kind: "url"; url: string; alt: string };

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

function clampZoom(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, rounded));
}

function clampPan(
  x: number,
  y: number,
  zoom: number,
  stage: { w: number; h: number },
): { x: number; y: number } {
  const maxX = (stage.w * Math.max(0, zoom - 1)) / 2;
  const maxY = (stage.h * Math.max(0, zoom - 1)) / 2;
  return {
    x: Math.max(-maxX, Math.min(maxX, x)),
    y: Math.max(-maxY, Math.min(maxY, y)),
  };
}

function RotateRightIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M19.5 4.5V9H15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DocumentImageViewer(props: {
  state: ImageViewerState | null;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
  onRotationChange?: (documentId: string, rotation: number) => void;
}) {
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const stageSizeRef = useRef(stageSize);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: "pan"; x: number; y: number; panX: number; panY: number }
    | { kind: "pinch"; dist: number; zoom: number }
    | null
  >(null);

  zoomRef.current = zoom;
  panRef.current = pan;
  stageSizeRef.current = stageSize;

  const current =
    props.state?.kind === "document" ? props.state.items[props.state.index] : null;
  const hasGallery = props.state?.kind === "document" && props.state.items.length > 1;
  const galleryIndex = props.state?.kind === "document" ? props.state.index : 0;
  const galleryLength = props.state?.kind === "document" ? props.state.items.length : 0;
  const viewKey =
    props.state?.kind === "url"
      ? `url:${props.state.url}`
      : props.state
        ? `doc:${current?.documentId ?? ""}:${galleryIndex}`
        : "";

  function applyZoom(next: number) {
    const z = clampZoom(next);
    zoomRef.current = z;
    setZoom(z);
    if (z <= MIN_ZOOM) {
      panRef.current = { x: 0, y: 0 };
      setPan({ x: 0, y: 0 });
      return;
    }
    const p = clampPan(panRef.current.x, panRef.current.y, z, stageSizeRef.current);
    panRef.current = p;
    setPan(p);
  }

  useEffect(() => {
    const saved =
      props.state?.kind === "document"
        ? normalizeRotation(props.state.items[props.state.index]?.rotation)
        : 0;
    setRotation(saved);
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
    gesture.current = null;
    pointers.current.clear();
  }, [viewKey]);

  useEffect(() => {
    if (!stageEl) return;
    const update = () => {
      const box = stageEl.getBoundingClientRect();
      const style = getComputedStyle(stageEl);
      const w = box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const h = box.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const next = { w: Math.max(0, w), h: Math.max(0, h) };
      stageSizeRef.current = next;
      setStageSize(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stageEl);
    return () => observer.disconnect();
  }, [stageEl]);

  useEffect(() => {
    if (!stageEl) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      applyZoom(zoomRef.current + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
    }
    stageEl.addEventListener("wheel", onWheel, { passive: false });
    return () => stageEl.removeEventListener("wheel", onWheel);
  }, [stageEl]);

  useEffect(() => {
    if (!props.state) {
      setSrc(null);
      return;
    }

    if (props.state.kind === "url") {
      setSrc(props.state.url);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setSrc(null);

    void fetchDocumentBlob(current!.documentId, current!.fileName)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [props.state, current?.documentId, current?.fileName]);

  useEffect(() => {
    if (!props.state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.state, props.onClose]);

  if (!props.state) return null;

  function goPrev() {
    if (props.state?.kind !== "document" || !props.onIndexChange) return;
    const next = props.state.index <= 0 ? props.state.items.length - 1 : props.state.index - 1;
    props.onIndexChange(next);
  }

  function goNext() {
    if (props.state?.kind !== "document" || !props.onIndexChange) return;
    const next =
      props.state.index >= props.state.items.length - 1 ? 0 : props.state.index + 1;
    props.onIndexChange(next);
  }

  function syncGesture() {
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      gesture.current = { kind: "pinch", dist: Math.max(dist, 1), zoom: zoomRef.current };
      return;
    }
    if (pts.length === 1 && zoomRef.current > MIN_ZOOM) {
      const pt = pts[0]!;
      gesture.current = {
        kind: "pan",
        x: pt.x,
        y: pt.y,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      return;
    }
    gesture.current = null;
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    syncGesture();
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const active = gesture.current;
    if (!active) return;
    if (active.kind === "pan") {
      const next = clampPan(
        active.panX + (e.clientX - active.x),
        active.panY + (e.clientY - active.y),
        zoomRef.current,
        stageSizeRef.current,
      );
      panRef.current = next;
      setPan(next);
      return;
    }
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return;
    const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
    applyZoom(active.zoom * (dist / active.dist));
  }

  function onPointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    syncGesture();
  }

  const alt =
    props.state.kind === "url"
      ? props.state.alt
      : current?.alt || current?.fileName || t("cars.photo");

  const quarterTurn = rotation % 180 !== 0;
  const fitW = stageSize.w > 0 ? (quarterTurn ? stageSize.h : stageSize.w) : undefined;
  const fitH = stageSize.h > 0 ? (quarterTurn ? stageSize.w : stageSize.h) : undefined;

  return createPortal(
    <div className="crm-image-viewer" role="dialog" aria-modal="true" aria-label={alt}>
      <div className="crm-image-viewer__toolbar">
        <button type="button" className="crm-image-viewer__back" onClick={props.onClose}>
          <Icon name="arrow-left-01" size={22} color="#fff" />
          <span>{t("common.back")}</span>
        </button>
        <div className="crm-image-viewer__toolbar-actions">
          {hasGallery ? (
            <span className="crm-image-viewer__counter">
              {galleryIndex + 1} / {galleryLength}
            </span>
          ) : null}
          {current ? (
            <button
              type="button"
              className="crm-image-viewer__download"
              aria-label={t("documents.download")}
              onClick={() => void downloadDocumentFile(current.documentId, current.fileName)}
            >
              <Icon name="download-01" size={20} color="#fff" />
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={setStageEl}
        className={`crm-image-viewer__stage${zoom > MIN_ZOOM ? " crm-image-viewer__stage--zoom" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {loading ? <span className="crm-spinner crm-image-viewer__spinner" /> : null}
        {!loading && src ? (
          <div
            className="crm-image-viewer__frame"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            <img
              className="crm-image-viewer__img"
              src={src}
              alt={alt}
              draggable={false}
              style={{
                transform: `rotate(${rotation}deg)`,
                ...(fitW && fitH ? { maxWidth: fitW, maxHeight: fitH } : {}),
              }}
            />
          </div>
        ) : !loading ? (
          <p className="crm-image-viewer__error">{t("documents.previewFailed")}</p>
        ) : null}
      </div>

      {!loading && src ? (
        <div className="crm-image-viewer__tools">
          <button
            type="button"
            className="crm-image-viewer__tool"
            aria-label={t("documents.zoomOut")}
            disabled={zoom <= MIN_ZOOM}
            onClick={() => applyZoom(zoomRef.current - ZOOM_STEP)}
          >
            <Icon name="minus-sign" size={20} color="#fff" />
          </button>
          <button
            type="button"
            className="crm-image-viewer__tool"
            aria-label={t("documents.zoomIn")}
            disabled={zoom >= MAX_ZOOM}
            onClick={() => applyZoom(zoomRef.current + ZOOM_STEP)}
          >
            <Icon name="add-01" size={20} color="#fff" />
          </button>
          <button
            type="button"
            className="crm-image-viewer__tool"
            aria-label={t("documents.rotateRight")}
            onClick={() => {
              const next = (rotation + 90) % 360;
              setRotation(next);
              panRef.current = { x: 0, y: 0 };
              setPan({ x: 0, y: 0 });
              if (current) props.onRotationChange?.(current.documentId, next);
            }}
          >
            <RotateRightIcon />
          </button>
        </div>
      ) : null}

      {hasGallery ? (
        <>
          <button
            type="button"
            className="crm-image-viewer__side crm-image-viewer__side--prev"
            onClick={goPrev}
            aria-label={t("cars.prevPhoto")}
          >
            <span className="crm-image-viewer__side-icon">
              <Icon name="arrow-left-01" size={24} color="#fff" />
            </span>
          </button>
          <button
            type="button"
            className="crm-image-viewer__side crm-image-viewer__side--next"
            onClick={goNext}
            aria-label={t("cars.nextPhoto")}
          >
            <span className="crm-image-viewer__side-icon">
              <Icon name="arrow-right-01" size={24} color="#fff" />
            </span>
          </button>
        </>
      ) : null}
    </div>,
    document.body,
  );
}
