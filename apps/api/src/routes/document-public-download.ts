import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { heicBufferToJpeg, isHeicFile } from "../services/heic.js";
import { verifyDocumentDownloadToken } from "../services/download-token.js";

function resolveMimeType(doc: { mimeType: string | null; fileName: string }): string {
  if (doc.mimeType?.trim()) return doc.mimeType;
  const lower = doc.fileName.toLowerCase();
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (/\.jpe?g$/.test(lower)) return "image/jpeg";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function contentDispositionAttachment(fileName: string): string {
  const ascii = fileName
    .replace(/[\r\n"\\]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .trim()
    .slice(0, 180) || "file";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Public (token-gated) download endpoint for Telegram WebApp.downloadFile.
 * Must NOT require Authorization — Telegram fetches the URL directly.
 */
export async function documentPublicDownloadRoutes(app: FastifyInstance): Promise<void> {
  app.options("/documents/:id/download", async (_req, reply) => {
    reply
      .header("Access-Control-Allow-Origin", "https://web.telegram.org")
      .header("Access-Control-Allow-Methods", "GET, OPTIONS")
      .header("Access-Control-Allow-Headers", "Content-Type")
      .code(204)
      .send();
  });

  app.get("/documents/:id/download", async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const token = (req.query as { token?: string }).token;
    if (!token) return reply.code(401).send({ error: "missing_download_token" });

    const verified = verifyDocumentDownloadToken(token, id);
    if (!verified) return reply.code(401).send({ error: "invalid_download_token" });

    const doc = await prisma.document.findFirst({
      where: { id, ownerId: verified.ownerId },
    });
    if (!doc) return reply.code(404).send({ error: "not_found" });

    reply
      .header("Access-Control-Allow-Origin", "https://web.telegram.org")
      .header("Cache-Control", "private, no-store");

    const fullPath = path.resolve(env.uploadsDir, doc.filePath);
    const mimeType = resolveMimeType(doc);

    // Use application/octet-stream so Telegram/iOS does not open the URL as an
    // inline image preview (which traps the user with no Mini App Back button).
    if (isHeicFile(doc.fileName, doc.mimeType)) {
      try {
        const jpeg = await heicBufferToJpeg(await readFile(fullPath));
        const previewName = doc.fileName.replace(/\.heif?c$/i, ".jpg");
        reply.header("Content-Disposition", contentDispositionAttachment(previewName));
        reply.type("application/octet-stream");
        return reply.send(jpeg);
      } catch (err) {
        req.log.warn({ err, documentId: id }, "HEIC conversion failed on public download");
        return reply.code(422).send({ error: "heic_conversion_failed" });
      }
    }

    reply.header("Content-Disposition", contentDispositionAttachment(doc.fileName));
    reply.type("application/octet-stream");
    void mimeType; // real type is in Content-Disposition filename
    return reply.send(createReadStream(fullPath));
  });
}
