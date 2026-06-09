import { useId, useRef, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "./ui";
import { useDocumentImageViewer } from "./useDocumentImageViewer";

export interface PendingCarPhoto {
  key: string;
  file: File;
  previewUrl: string;
}

export function CarPhotoPicker(props: {
  photos: PendingCarPhoto[];
  coverKey: string | null;
  onPhotosChange: Dispatch<SetStateAction<PendingCarPhoto[]>>;
  onCoverKeyChange: (key: string | null) => void;
  hideLabel?: boolean;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const { openUrl, viewer } = useDocumentImageViewer();

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const added: PendingCarPhoto[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      added.push({ key, file, previewUrl: URL.createObjectURL(file) });
    }
    if (added.length === 0) return;

    props.onPhotosChange((prev) => {
      const next = [...prev, ...added];
      if (!props.coverKey && next[0]) {
        props.onCoverKeyChange(next[0].key);
      }
      return next;
    });

    if (fileRef.current) fileRef.current.value = "";
  }

  function removePhoto(key: string) {
    props.onPhotosChange((prev) => {
      const removed = prev.find((p) => p.key === key);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      const next = prev.filter((p) => p.key !== key);
      let cover = props.coverKey;
      if (cover === key) cover = next[0]?.key ?? null;
      props.onCoverKeyChange(cover);
      return next;
    });
  }

  const grid = (
    <>
      {props.photos.length > 0 ? (
        <>
          <p className="crm-form-hint">{t("cars.pickCoverHint")}</p>
          <div className="crm-car-photo-grid">
            {props.photos.map((photo) => {
              const isCover = props.coverKey === photo.key;
              return (
                <div key={photo.key} className={`crm-car-photo-tile${isCover ? " crm-car-photo-tile--cover" : ""}`}>
                  <button
                    type="button"
                    className="crm-car-photo-tile__select"
                    onClick={() => openUrl(photo.previewUrl, t("cars.photo"))}
                    aria-label={t("cars.photo")}
                  >
                    <img src={photo.previewUrl} alt="" className="crm-car-photo-tile__img" />
                    {isCover ? <span className="crm-car-photo-tile__badge">{t("cars.coverPhoto")}</span> : null}
                  </button>
                  <button
                    type="button"
                    className={`crm-car-photo-tile__cover-btn${isCover ? " crm-car-photo-tile__cover-btn--active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onCoverKeyChange(photo.key);
                    }}
                  >
                    {t("cars.coverPhoto")}
                  </button>
                  <button
                    type="button"
                    className="crm-car-photo-tile__remove"
                    onClick={() => removePhoto(photo.key)}
                    aria-label={t("common.delete")}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="crm-car-photo-picker__placeholder">{t("cars.noPhoto")}</div>
      )}
      <div className="crm-car-photo-picker__actions">
        <label htmlFor={inputId} className="crm-btn-outline crm-car-photo-picker__add-label">
          + {t("cars.addPhotos")}
        </label>
        <input
          id={inputId}
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          multiple
          className="crm-file-input-hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>
      {viewer}
    </>
  );

  if (props.hideLabel) {
    return <div className="crm-agreement-section">{grid}</div>;
  }

  return <Field label={t("cars.photos")}>{grid}</Field>;
}
