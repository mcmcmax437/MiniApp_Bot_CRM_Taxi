export function isImageDocument(doc: { mimeType: string | null; fileName: string }): boolean {
  if (doc.mimeType?.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(doc.fileName);
}
