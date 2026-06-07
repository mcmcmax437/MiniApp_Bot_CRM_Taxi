import convert from "heic-convert";

export function isHeicFile(fileName: string, mimeType?: string | null): boolean {
  const mime = mimeType?.toLowerCase() ?? "";
  if (mime.includes("heic") || mime.includes("heif")) return true;
  return /\.heif?c$/i.test(fileName);
}

export async function heicBufferToJpeg(buffer: Buffer): Promise<Buffer> {
  const output = await convert({
    buffer,
    format: "JPEG",
    quality: 0.92,
  });
  return Buffer.from(output);
}
