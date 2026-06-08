import { useEffect, useState } from "react";
import { fetchDocumentBlob } from "./documentUtils";
import { Icon } from "./crm";

export function DocumentThumbnail(props: {
  documentId: string;
  alt: string;
  fileName?: string;
  className?: string;
  onClick?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    void fetchDocumentBlob(props.documentId, props.fileName ?? props.alt)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [props.documentId, props.fileName, props.alt]);

  if (!src) {
    return (
      <div className={`crm-doc-thumb crm-doc-thumb--placeholder${props.className ? ` ${props.className}` : ""}`}>
        <Icon name="file-02" size={28} color="rgba(255,255,255,0.35)" />
      </div>
    );
  }

  const img = <img className={`crm-doc-thumb__img${props.className ? ` ${props.className}` : ""}`} src={src} alt={props.alt} />;

  if (props.onClick) {
    return (
      <button type="button" className="crm-doc-thumb crm-doc-thumb--btn" onClick={props.onClick}>
        {img}
      </button>
    );
  }

  return <div className="crm-doc-thumb">{img}</div>;
}
