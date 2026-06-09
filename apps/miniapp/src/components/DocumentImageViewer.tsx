import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Icon } from "./crm";
import { fetchDocumentBlob } from "./documentUtils";

export type DocumentViewerItem = {
  documentId: string;
  fileName: string;
  alt?: string;
};

export type ImageViewerState =
  | { kind: "document"; items: DocumentViewerItem[]; index: number }
  | { kind: "url"; url: string; alt: string };

export function DocumentImageViewer(props: {
  state: ImageViewerState | null;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}) {
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const current =
    props.state?.kind === "document" ? props.state.items[props.state.index] : null;
  const hasGallery = props.state?.kind === "document" && props.state.items.length > 1;
  const galleryIndex = props.state?.kind === "document" ? props.state.index : 0;
  const galleryLength = props.state?.kind === "document" ? props.state.items.length : 0;

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

  const alt =
    props.state.kind === "url"
      ? props.state.alt
      : current?.alt || current?.fileName || t("cars.photo");

  return createPortal(
    <div className="crm-image-viewer" role="dialog" aria-modal="true" aria-label={alt}>
      <div className="crm-image-viewer__toolbar">
        <button type="button" className="crm-image-viewer__back" onClick={props.onClose}>
          <Icon name="arrow-left-01" size={22} color="#fff" />
          <span>{t("common.back")}</span>
        </button>
        {hasGallery ? (
          <span className="crm-image-viewer__counter">
            {galleryIndex + 1} / {galleryLength}
          </span>
        ) : null}
      </div>

      <div className="crm-image-viewer__stage">
        {loading ? <span className="crm-spinner crm-image-viewer__spinner" /> : null}
        {!loading && src ? (
          <img className="crm-image-viewer__img" src={src} alt={alt} />
        ) : !loading ? (
          <p className="crm-image-viewer__error">{t("documents.previewFailed")}</p>
        ) : null}
      </div>

      {hasGallery ? (
        <>
          <button
            type="button"
            className="crm-image-viewer__nav crm-image-viewer__nav--prev"
            onClick={goPrev}
            aria-label={t("cars.prevPhoto")}
          >
            <Icon name="arrow-left-01" size={24} color="#fff" />
          </button>
          <button
            type="button"
            className="crm-image-viewer__nav crm-image-viewer__nav--next"
            onClick={goNext}
            aria-label={t("cars.nextPhoto")}
          >
            <Icon name="arrow-right-01" size={24} color="#fff" />
          </button>
        </>
      ) : null}
    </div>,
    document.body,
  );
}
