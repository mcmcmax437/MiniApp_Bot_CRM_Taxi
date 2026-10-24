import i18n from "../i18n";
import type { DocumentItem } from "../types";
import { apiFetch, apiFileUrl } from "../api";
import {
  canTelegramDownloadFile,
  getInitData,
  showAlert,
  telegramDownloadFile,
} from "../telegram";

export function documentDisplayName(doc: Pick<DocumentItem, "displayName" | "fileName">): string {
  const custom = doc.displayName?.trim();
  return custom || doc.fileName;
}

export function isCarGalleryPhoto(
  doc: Pick<DocumentItem, "isCarPhoto" | "mimeType" | "fileName">,
): boolean {
  return Boolean(doc.isCarPhoto) && isImageDocument(doc);
}

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

function downloadFileName(fileName: string): string {
  return fileName.replace(/\.heif?c$/i, ".jpg");
}

/** Browsers cannot render HEIC in <img>; server converts HEIC to JPEG, client fallback if needed. */
export async function blobForImagePreview(blob: Blob, fileName?: string): Promise<Blob> {
  if (!isHeicBlob(blob, fileName)) return blob;
  if (blob.type === "image/jpeg" || blob.type === "image/jpg") return blob;
  try {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob, toType: "image/jpeg", quality: 0.92 });
    return Array.isArray(converted) ? converted[0]! : converted;
  } catch {
    return blob;
  }
}

export async function fetchDocumentBlob(documentId: string, fileName?: string): Promise<Blob> {
  const res = await fetch(apiFileUrl(documentId), {
    headers: { Authorization: `tma ${getInitData()}` },
  });
  if (!res.ok) throw new Error("failed");
  const blob = await res.blob();
  return blobForImagePreview(blob, fileName);
}

function isIosLike(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

async function shareBlobAsFile(blob: Blob, fileName: string): Promise<boolean> {
  const name = downloadFileName(fileName);
  const type = blob.type || "application/octet-stream";
  const file = new File([blob], name, { type });
  const payload = { files: [file] };
  const nav = navigator as Navigator & {
    canShare?: (data?: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  if (typeof nav.canShare === "function" && !nav.canShare(payload)) return false;
  if (typeof nav.share !== "function") return false;
  try {
    await nav.share(payload);
    return true;
  } catch {
    // User cancelled or share failed.
    return false;
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = downloadFileName(fileName);
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function downloadViaTelegramNative(documentId: string, fileName: string): Promise<boolean> {
  if (!canTelegramDownloadFile()) return false;
  try {
    const link = await apiFetch<{ path: string; fileName: string }>(
      `/documents/${encodeURIComponent(documentId)}/download-link`,
    );
    const absoluteUrl = new URL(link.path, window.location.origin).toString();
    if (!/^https:/i.test(absoluteUrl)) return false;
    return telegramDownloadFile(absoluteUrl, downloadFileName(link.fileName || fileName));
  } catch {
    return false;
  }
}

/**
 * Save a document to the device.
 * Telegram iOS WebView ignores blob + <a download>, so we prefer:
 * 1) Telegram.WebApp.downloadFile with a short-lived HTTPS URL
 * 2) Web Share sheet (Save Image) on iOS
 * 3) Classic blob download elsewhere
 */
export async function downloadDocumentFile(documentId: string, fileName: string): Promise<void> {
  try {
    if (await downloadViaTelegramNative(documentId, fileName)) return;

    const blob = await fetchDocumentBlob(documentId, fileName);
    if (isIosLike() && (await shareBlobAsFile(blob, fileName))) return;

    downloadBlob(blob, fileName);

    // On iOS without share/Telegram APIs, blob download is often a silent no-op.
    if (isIosLike()) {
      showAlert(i18n.t("documents.downloadIosHint"));
    }
  } catch {
    showAlert(i18n.t("documents.downloadFailed"));
  }
}

export async function openDocumentFile(documentId: string, fileName: string): Promise<void> {
  const blob = await fetchDocumentBlob(documentId, fileName);
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");
  if (!opened) {
    if (!(await shareBlobAsFile(blob, fileName))) {
      downloadBlob(blob, fileName);
    }
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
