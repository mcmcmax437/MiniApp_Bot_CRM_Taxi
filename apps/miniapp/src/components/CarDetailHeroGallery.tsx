import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocuments } from "../hooks";
import { isCarGalleryPhoto } from "./documentUtils";
import { DocumentThumbnail } from "./DocumentThumbnail";
import { useDocumentImageViewer } from "./useDocumentImageViewer";
import { Icon } from "./crm";

export function CarDetailHeroGallery(props: {
  carId: string;
  coverDocumentId: string | null | undefined;
  alt: string;
}) {
  const { t } = useTranslation();
  const docs = useDocuments("CAR", props.carId);
  const photos = useMemo(() => (docs.data ?? []).filter(isCarGalleryPhoto), [docs.data]);
  const [index, setIndex] = useState(0);
  const { openDocuments, viewer } = useDocumentImageViewer();

  useEffect(() => {
    const preferredIdx = props.coverDocumentId
      ? photos.findIndex((d) => d.id === props.coverDocumentId)
      : -1;
    setIndex(preferredIdx >= 0 ? preferredIdx : 0);
  }, [props.carId]);

  useEffect(() => {
    if (!props.coverDocumentId || photos.length === 0) return;
    const idx = photos.findIndex((d) => d.id === props.coverDocumentId);
    if (idx >= 0) setIndex(idx);
  }, [props.coverDocumentId, photos.length]);

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, photos.length - 1)));
  }, [photos.length]);

  const current = photos[index];
  const hasMultiple = photos.length > 1;

  function goPrev() {
    setIndex((i) => (i <= 0 ? photos.length - 1 : i - 1));
  }

  function goNext() {
    setIndex((i) => (i >= photos.length - 1 ? 0 : i + 1));
  }

  function openCurrentPhoto() {
    openDocuments(
      photos.map((doc) => ({
        documentId: doc.id,
        fileName: doc.fileName,
        alt: props.alt,
      })),
      index,
    );
  }

  if (!current) {
    return (
      <div className="crm-car-detail-hero">
        <div className="crm-car-detail-hero__placeholder">
          <Icon name="car-01" size={48} color="rgba(255,255,255,0.35)" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="crm-car-detail-hero">
        <DocumentThumbnail
          key={current.id}
          documentId={current.id}
          fileName={current.fileName}
          alt={props.alt}
          className="crm-car-detail-hero__img"
        />
        <button
          type="button"
          className="crm-car-detail-hero__tap"
          onClick={openCurrentPhoto}
          aria-label={t("cars.photo")}
        />
        {hasMultiple ? (
          <>
            <button
              type="button"
              className="crm-car-detail-hero__nav crm-car-detail-hero__nav--prev"
              onClick={goPrev}
              aria-label={t("cars.prevPhoto")}
            >
              <Icon name="arrow-left-01" size={22} color="#fff" />
            </button>
            <button
              type="button"
              className="crm-car-detail-hero__nav crm-car-detail-hero__nav--next"
              onClick={goNext}
              aria-label={t("cars.nextPhoto")}
            >
              <Icon name="arrow-right-01" size={22} color="#fff" />
            </button>
          </>
        ) : null}
      </div>
      {viewer}
    </>
  );
}
