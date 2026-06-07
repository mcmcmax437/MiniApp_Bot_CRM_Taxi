import type { DocumentItem } from "../types";
import { apiFileUrl } from "../api";
import { getInitData } from "../telegram";

export function isImageDocument(doc: Pick<DocumentItem, "mimeType" | "fileName">): boolean {
  if (doc.mimeType?.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(doc.fileName);
}

export function isPdfDocument(doc: Pick<DocumentItem, "mimeType" | "fileName">): boolean {
  if (doc.mimeType === "application/pdf") return true;
  return /\.pdf$/i.test(doc.fileName);
}

function isHeicBlob(blob: Blob, fileName?: string): boolean {
  const type = blob.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  if (fileName && /\.heif?c$/i.test(fileName)) return true;
  return false;
}

/** Browsers cannot render HEIC in <img>; convert to JPEG for previews. */
export async function blobForImagePreview(blob: Blob, fileName?: string): Promise<Blob> {
  if (!isHeicBlob(blob, fileName)) return blob;
  const heic2any = (await import("heic2any")).default;
  const converted = await heic2any({ blob, toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(converted) ? converted[0]! : converted;
}

export async function fetchDocumentBlob(documentId: string, fileName?: string): Promise<Blob> {
  const res = await fetch(apiFileUrl(documentId), {
    headers: { Authorization: `tma ${getInitData()}` },
  });
  if (!res.ok) throw new Error("failed");
  const blob = await res.blob();
  return blobForImagePreview(blob, fileName);
}

export async function openDocumentFile(documentId: string, fileName: string): Promise<void> {
  const blob = await fetchDocumentBlob(documentId, fileName);
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName.replace(/\.heic$/i, ".jpg");
    link.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
