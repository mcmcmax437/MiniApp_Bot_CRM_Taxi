import i18n from "../i18n";
import type { DocumentItem } from "../types";
import { ApiError, apiFetch, apiFileUrl } from "../api";
import {
  canTelegramDownloadFile,
  getInitData,
  getPlatform,
  isInsideTelegram,
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

/** Clockwise degrees stored on a document image. */
export function normalizeRotation(value: number | null | undefined): 0 | 90 | 180 | 270 {
  const quarter = ((Math.round((value ?? 0) / 90) * 90) % 360 + 360) % 360;
  if (quarter === 90 || quarter === 180 || quarter === 270) return quarter;
  return 0;
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

function looksLikeImageFile(fileName: string, blob?: Blob): boolean {
  if (blob?.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(fileName);
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
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Phone Telegram keeps the share sheet / native downloadFile path.
 * Desktop (and a normal browser) must not: Windows share and Telegram
 * Desktop's downloadFile save a tiny gray JPEG instead of the photo.
 */
function useDirectFileDownload(): boolean {
  if (isIosLike()) return false;
  const platform = getPlatform().toLowerCase();
  if (platform === "android" || platform === "android_x") return false;
  if (!isInsideTelegram) return true;
  return (
    platform === "tdesktop" ||
    platform === "macos" ||
    platform === "web" ||
    platform === "weba" ||
    platform === "unigram" ||
    platform === "unknown" ||
    platform === "base"
  );
}

async function shareBlobAsFile(blob: Blob, fileName: string): Promise<boolean> {
  const name = downloadFileName(fileName);
  const type = blob.type?.startsWith("image/") ? blob.type : "image/jpeg";
  const nav = navigator as Navigator & {
    canShare?: (data?: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  if (typeof nav.share !== "function") return false;

  try {
    const file = new File([blob], name, { type });
    const payload = { files: [file] };
    // Telegram iOS often reports canShare(files)=false even when share works.
    // Only skip when canShare exists AND we are not on iOS.
    if (!isIosLike() && typeof nav.canShare === "function" && !nav.canShare(payload)) {
      return false;
    }
    await nav.share(payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * Classic anchor download. NEVER use for images inside Telegram/iOS WebViews —
 * iOS ignores `download` and navigates to the blob URL (fullscreen image, no Back).
 */
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

let chatSendInFlight = false;

/** Ask the bot to post this file in the user's Telegram chat. */
async function sendDocumentToChat(documentId: string): Promise<void> {
  if (chatSendInFlight) return;
  chatSendInFlight = true;
  try {
    await apiFetch(`/documents/${encodeURIComponent(documentId)}/send-to-chat`);
    showAlert(i18n.t("documents.downloadSentToChat"));
  } catch (err) {
    if (err instanceof ApiError && err.code === "bot_chat_unavailable") {
      showAlert(i18n.t("documents.downloadOpenBot"));
      return;
    }
    showAlert(i18n.t("documents.downloadFailed"));
  } finally {
    chatSendInFlight = false;
  }
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
 * Save a document to the device without navigating away from the Mini App.
 *
 * iOS/Telegram WebView will open images fullscreen (no Back) if we use
 * blob:/<a download> or open an image URL — so those paths are avoided there.
 */
export async function downloadDocumentFile(documentId: string, fileName: string): Promise<void> {
  const ios = isIosLike();
  const image = looksLikeImageFile(fileName);

  try {
    // On iPhone/iPad: NEVER use blob/<a download> — iOS ignores `download` and
    // navigates the WebView to the image (fullscreen, no Mini App Back).
    // Prefer Share → Save Image; then Telegram native downloadFile.
    if (ios) {
      const blob = await fetchDocumentBlob(documentId, fileName);
      if (image && (await shareBlobAsFile(blob, fileName))) return;
      if (await downloadViaTelegramNative(documentId, fileName)) return;
      if (!image && (await shareBlobAsFile(blob, fileName))) return;
      showAlert(i18n.t("documents.downloadIosHint"));
      return;
    }

    if (useDirectFileDownload()) {
      await sendDocumentToChat(documentId);
      return;
    }

    if (await downloadViaTelegramNative(documentId, fileName)) return;

    const blob = await fetchDocumentBlob(documentId, fileName);
    if (await shareBlobAsFile(blob, fileName)) return;

    downloadBlob(blob, fileName);
  } catch {
    showAlert(i18n.t("documents.downloadFailed"));
  }
}

/**
 * Open a non-image document. Images should use the in-app viewer — never
 * window.open a blob image on iOS (traps the user with no Back).
 */
export async function openDocumentFile(documentId: string, fileName: string): Promise<void> {
  if (isIosLike() && looksLikeImageFile(fileName)) {
    // Prefer share from the viewer; opening blob URLs breaks navigation.
    await downloadDocumentFile(documentId, fileName);
    return;
  }

  const blob = await fetchDocumentBlob(documentId, fileName);
  if (isIosLike()) {
    if (await shareBlobAsFile(blob, fileName)) return;
    showAlert(i18n.t("documents.downloadIosHint"));
    return;
  }

  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");
  if (!opened) {
    downloadBlob(blob, fileName);
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
