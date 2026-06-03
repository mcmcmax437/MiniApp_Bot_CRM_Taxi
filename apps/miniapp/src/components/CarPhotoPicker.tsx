import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "./ui";

export interface PendingCarPhoto {
  key: string;
  file: File;
  previewUrl: string;
}

export function CarPhotoPicker(props: {
  photos: PendingCarPhoto[];
  coverKey: string | null;
  onPhotosChange: (photos: PendingCarPhoto[]) => void;
  onCoverKeyChange: (key: string | null) => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const next = [...props.photos];
    let cover = props.coverKey;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      next.push({ key, file, previewUrl: URL.createObjectURL(file) });
      if (!cover) cover = key;
    }
    props.onPhotosChange(next);
    props.onCoverKeyChange(cover);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removePhoto(key: string) {
    const removed = props.photos.find((p) => p.key === key);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    const next = props.photos.filter((p) => p.key !== key);
    let cover = props.coverKey;
    if (cover === key) {
      cover = next[0]?.key ?? null;
    }
    props.onPhotosChange(next);
    props.onCoverKeyChange(cover);
  }

  return (
    <Field label={t("cars.photos")}>
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
                    onClick={() => props.onCoverKeyChange(photo.key)}
                    aria-label={t("cars.setAsCover")}
                  >
                    <img src={photo.previewUrl} alt="" className="crm-car-photo-tile__img" />
                    {isCover ? <span className="crm-car-photo-tile__badge">{t("cars.coverPhoto")}</span> : null}
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
      <div className="crm-car-photo-picker__actions" style={{ marginTop: 10 }}>
        <button type="button" className="crm-btn-outline" onClick={() => fileRef.current?.click()}>
          + {t("cars.addPhotos")}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />
    </Field>
  );
}
