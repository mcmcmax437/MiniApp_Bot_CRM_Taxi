import type { DocumentItem } from "../types";
import { apiFileUrl } from "../api";
import { getInitData } from "../telegram";

export function isImageDocument(doc: Pick<DocumentItem, "mimeType" | "fileName">): boolean {
  if (doc.mimeType?.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(doc.fileName);
}

export function isPdfDocument(doc: Pick<DocumentItem, "mimeType" | "fileName">): boolean {
  if (doc.mimeType === "application/pdf") return true;
  return /\.pdf$/i.test(doc.fileName);
}

export async function fetchDocumentBlob(documentId: string): Promise<Blob> {
  const res = await fetch(apiFileUrl(documentId), {
    headers: { Authorization: `tma ${getInitData()}` },
  });
  if (!res.ok) throw new Error("failed");
  return res.blob();
}

export async function openDocumentFile(documentId: string, fileName: string): Promise<void> {
  const blob = await fetchDocumentBlob(documentId);
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
